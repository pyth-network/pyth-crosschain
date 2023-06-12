// This package is derived from the node/pkgs/p2p.go file in the Wormhole project.
//
// This file has been stripped down to only what is necessary to participate in
// P2P and receive message and VAA observations from the network. It is not
// intended to be used as a full node implementation and can be replaced with
// Rust code once QUIC+TLS stable support is available in rust-libp2p.

package main

// #include <stdlib.h>
// #include <string.h>
//
// // A structure containing Wormhole VAA observations. This must match on both
// // the Go and Rust side.
// typedef struct {
//     char const *vaa;
//     size_t      vaa_len;
// } observation_t;
//
// // A small proxy method to invoke the Rust callback from CGo. This is due
// // to the fact that CGo does not support calling C functions directly from
// // Go. By passing it to this proxy Go is able to suspend the GC correctly
// // and the callback is invoked from a separate thread.
// typedef void (*callback_t)(observation_t);
// static void invoke(callback_t f, observation_t o) { f(o); }
import "C"

import (
	"context"
	"fmt"
	"os"
	"strings"
	"time"

    "net/http"
    _ "net/http/pprof"

	"github.com/libp2p/go-libp2p"
	"github.com/libp2p/go-libp2p/core/crypto"
	"github.com/libp2p/go-libp2p/core/host"
	"github.com/libp2p/go-libp2p/core/peer"
	"github.com/libp2p/go-libp2p/core/protocol"
	"github.com/libp2p/go-libp2p/core/routing"
	"github.com/libp2p/go-libp2p/p2p/net/connmgr"
	"github.com/multiformats/go-multiaddr"
	"google.golang.org/protobuf/proto"

	dht "github.com/libp2p/go-libp2p-kad-dht"
	pubsub "github.com/libp2p/go-libp2p-pubsub"
	libp2ptls "github.com/libp2p/go-libp2p/p2p/security/tls"
	libp2pquic "github.com/libp2p/go-libp2p/p2p/transport/quic"
	libp2pquicreuse "github.com/libp2p/go-libp2p/p2p/transport/quicreuse"
)

//export RegisterObservationCallback
func RegisterObservationCallback(f C.callback_t, network_id, bootstrap_addrs, listen_addrs *C.char) {
	networkID := C.GoString(network_id)
	bootstrapAddrs := strings.Split(C.GoString(bootstrap_addrs), ",")
	listenAddrs := strings.Split(C.GoString(listen_addrs), ",")

    // Bind pprof to 6060 for debugging Go code.
    go func() {
        http.ListenAndServe("127.0.0.1:6060", nil)
    }()

	var startTime int64
	var recoverRerun func()

	routine := func() {
		defer recoverRerun()

		// Record the current time
		startTime = time.Now().UnixNano()

		ctx := context.Background()

		// Setup base network configuration.
		priv, _, err := crypto.GenerateKeyPair(crypto.Ed25519, -1)
		if err != nil {
			err := fmt.Errorf("Failed to generate key pair: %w", err)
			fmt.Println(err)
			return
		}

		// Setup libp2p Connection Manager.
		mgr, err := connmgr.NewConnManager(
			100,
			400,
			connmgr.WithGracePeriod(0),
		)

		if err != nil {
			err := fmt.Errorf("Failed to create connection manager: %w", err)
			fmt.Println(err)
			return
		}

		// Setup libp2p Reactor.
		h, err := libp2p.New(
			libp2p.Identity(priv),
			libp2p.ListenAddrStrings(listenAddrs...),
			libp2p.Security(libp2ptls.ID, libp2ptls.New),
			// Disable Reuse because upon panic, the Close() call on the p2p reactor does not properly clean up the
			// open ports (they are kept around for re-use, this seems to be a libp2p bug in the reuse `gc()` call
			// which can be found here:
			//
			// https://github.com/libp2p/go-libp2p/blob/master/p2p/transport/quicreuse/reuse.go#L97
			//
			// By disabling this we get correct Close() behaviour.
			//
			// IMPORTANT: Normally re-use allows libp2p to dial on the same port that is used to listen for traffic
			// and by disabling this dialing uses a random high port (32768-60999) which causes the nodes that we
			// connect to by dialing (instead of them connecting to us) will respond on the high range port instead
			// of the specified Dial port. This requires firewalls to be configured to allow (UDP 32768-60999) which
			// should be specified in our documentation.
			//
			// The best way to securely enable this range is via the conntrack module, which can statefully allow
			// UDP packets only when a sent UDP packet is present in the conntrack table. This rule looks roughly
			// like this:
			//
			// iptables -A INPUT -m conntrack --ctstate RELATED,ESTABLISHED -j ACCEPT
			//
			// Which is a standard rule in many firewall configurations (RELATED is the key flag).
			libp2p.QUICReuse(libp2pquicreuse.NewConnManager, libp2pquicreuse.DisableReuseport()),
			libp2p.Transport(libp2pquic.NewTransport),
			libp2p.ConnectionManager(mgr),
			libp2p.Routing(func(h host.Host) (routing.PeerRouting, error) {
				bootstrappers := make([]peer.AddrInfo, 0)
				for _, addr := range bootstrapAddrs {
					ma, err := multiaddr.NewMultiaddr(addr)
					if err != nil {
						continue
					}

					pi, err := peer.AddrInfoFromP2pAddr(ma)
					if err != nil || pi.ID == h.ID() {
						continue
					}

					bootstrappers = append(bootstrappers, *pi)
				}
				idht, err := dht.New(ctx, h, dht.Mode(dht.ModeServer),
					dht.ProtocolPrefix(protocol.ID("/"+networkID)),
					dht.BootstrapPeers(bootstrappers...),
				)
				return idht, err
			}),
		)

		if err != nil {
			err := fmt.Errorf("Failed to create libp2p host: %w", err)
			fmt.Println(err)
			return
		}

		defer h.Close()

		topic := fmt.Sprintf("%s/%s", networkID, "broadcast")
		ps, err := pubsub.NewGossipSub(ctx, h)
		if err != nil {
			err := fmt.Errorf("Failed to create Pubsub: %w", err)
			fmt.Println(err)
			return
		}

		th, err := ps.Join(topic)
		if err != nil {
			err := fmt.Errorf("Failed to join topic: %w", err)
			fmt.Println(err)
			return
		}

		defer th.Close()

		sub, err := th.Subscribe()
		if err != nil {
			err := fmt.Errorf("Failed to subscribe topic: %w", err)
			fmt.Println(err)
			return
		}

		defer sub.Cancel()

		for {
			for {
				select {
				case <-ctx.Done():
					return
				default:
					envelope, err := sub.Next(ctx)
					if err != nil {
						err := fmt.Errorf("Failed to receive Pubsub message: %w", err)
						fmt.Println(err)
						return
					}

					// Definition for GossipMessage is generated by Protobuf, see `p2p.proto`.
					var msg GossipMessage
					err = proto.Unmarshal(envelope.Data, &msg)

					switch msg.Message.(type) {
					case *GossipMessage_SignedObservation:
					case *GossipMessage_SignedVaaWithQuorum:
						vaaBytes := msg.GetSignedVaaWithQuorum().GetVaa()
						cBytes := C.CBytes(vaaBytes)
						defer C.free(cBytes)
						C.invoke(f, C.observation_t{
							vaa:     (*C.char)(cBytes),
							vaa_len: C.size_t(len(vaaBytes)),
						})
					}
				}
			}
		}
	}

	recoverRerun = func() {
		// Print the error if any and recall routine
		if err := recover(); err != nil {
			fmt.Fprintf(os.Stderr, "p2p.go error: %v\n", err)
		}

		// Sleep for 1 second if the time elapsed is less than 30 seconds
		// to avoid spamming the network with requests.
		elapsed := time.Duration(time.Now().UnixNano() - startTime)
		if elapsed < 30*time.Second {
			time.Sleep(1 * time.Second)
		}

		go routine()
	}

	go routine()
}

func main() {
}
