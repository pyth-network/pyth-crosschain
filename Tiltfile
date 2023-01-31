# This Tiltfile contains the deployment and build config for the Pyth Crosschain development environment.
#
#  We use Buildkit cache mounts and careful layering to avoid unnecessary rebuilds - almost
#  all source code changes result in small, incremental rebuilds. Dockerfiles are written such
#  that, for example, changing the contract source code won't cause Solana itself to be rebuilt.
#

load("ext://namespace", "namespace_create", "namespace_inject")
load("ext://secret", "secret_yaml_generic")

allow_k8s_contexts("ci")

# Disable telemetry by default
analytics_settings(False)

# Moar updates (default is 3)
update_settings(max_parallel_updates=10)

# Runtime configuration
config.define_bool("ci", False, "We are running in CI")
config.define_bool("manual", False, "Set TRIGGER_MODE_MANUAL by default")

config.define_string("num", False, "Number of guardian nodes to run")

# You do not usually need to set this argument - this argument is for debugging only. If you do use a different
# namespace, note that the "wormhole" namespace is hardcoded in tests and don't forget specifying the argument
# when running "tilt down".
#
config.define_string("namespace", False, "Kubernetes namespace to use")

# These arguments will enable writing Guardian events to a cloud BigTable instance.
# Writing to a cloud BigTable is optional. These arguments are not required to run the devnet.
config.define_string("gcpProject", False, "GCP project ID for BigTable persistence")
config.define_string("bigTableKeyPath", False, "Path to BigTable json key file")

# When running Tilt on a server, this can be used to set the public hostname Tilt runs on
# for service links in the UI to work.
config.define_string("webHost", False, "Public hostname for port forwards")

# Components
config.define_bool("pyth", False, "Enable Pyth-to-Wormhole component")

cfg = config.parse()
num_guardians = int(cfg.get("num", "1"))
namespace = cfg.get("namespace", "wormhole")
gcpProject = cfg.get("gcpProject", "local-dev")
bigTableKeyPath = cfg.get("bigTableKeyPath", "./event_database/devnet_key.json")
webHost = cfg.get("webHost", "localhost")
ci = cfg.get("ci", False)


if cfg.get("manual", False):
    trigger_mode = TRIGGER_MODE_MANUAL
else:
    trigger_mode = TRIGGER_MODE_AUTO

# namespace

if not ci:
    namespace_create(namespace)

def k8s_yaml_with_ns(objects):
    return k8s_yaml(namespace_inject(objects, namespace))

# Build lerna docker base for npm project
docker_build(
    ref = "lerna",
    context = ".",
    dockerfile = "tilt_devnet/docker_images/Dockerfile.lerna",
)

def build_node_yaml():
    node_yaml = read_yaml_stream("tilt_devnet/k8s/node.yaml")

    for obj in node_yaml:
        if obj["kind"] == "StatefulSet" and obj["metadata"]["name"] == "guardian":
            obj["spec"]["replicas"] = num_guardians
            container = obj["spec"]["template"]["spec"]["containers"][0]
            if container["name"] != "guardiand":
                fail("container 0 is not guardiand")
            container["command"] += ["--devNumGuardians", str(num_guardians)]

    return encode_yaml_stream(node_yaml)

k8s_yaml_with_ns(build_node_yaml())

k8s_resource(
    "guardian",
    resource_deps = ["eth-devnet", "eth-devnet2", "terra-terrad", "solana-devnet"],
    port_forwards = [
        port_forward(6060, name = "Debug/Status Server [:6060]", host = webHost),
        port_forward(7070, name = "Public gRPC [:7070]", host = webHost),
        port_forward(7071, name = "Public REST [:7071]", host = webHost),
        port_forward(2345, name = "Debugger [:2345]", host = webHost),
    ],
    labels = ["guardian"],
    trigger_mode = trigger_mode,
)

# spy
k8s_yaml_with_ns("tilt_devnet/k8s/spy.yaml")

k8s_resource(
    "spy",
    resource_deps = ["guardian"],
    port_forwards = [
        port_forward(6061, container_port = 6060, name = "Debug/Status Server [:6061]", host = webHost),
        port_forward(7072, name = "Spy gRPC [:7072]", host = webHost),
    ],
    labels = ["guardian"],
    trigger_mode = trigger_mode,
)

# solana client cli (used for devnet setup)

docker_build(
    ref = "bridge-client",
    context = ".",
    dockerfile = "tilt_devnet/docker_images/Dockerfile.client",
)

# solana smart contract

docker_build(
    ref = "solana-contract",
    context = ".",
    dockerfile = "tilt_devnet/docker_images/Dockerfile.solana",
)

# solana local devnet

k8s_yaml_with_ns("tilt_devnet/k8s/solana-devnet.yaml")

k8s_resource(
    "solana-devnet",
    port_forwards = [
        port_forward(8899, name = "Solana RPC [:8899]", host = webHost),
        port_forward(8900, name = "Solana WS [:8900]", host = webHost),
        port_forward(9000, name = "Solana PubSub [:9000]", host = webHost),
    ],
    labels = ["solana"],
    trigger_mode = trigger_mode,
)

# eth devnet

docker_build(
    ref = "eth-node",
    context = "./",
    dockerfile = "tilt_devnet/docker_images/Dockerfile.ethereum",

    # sync external scripts for incremental development
    # (everything else needs to be restarted from scratch for determinism)
    #
    # This relies on --update-mode=exec to work properly with a non-root user.
    # https://github.com/tilt-dev/tilt/issues/3708
    live_update = [
        sync("./ethereum/src", "/home/node/app/src"),
    ],
)

# pyth autopublisher
docker_build(
    ref = "pyth",
    context = ".",
    dockerfile = "third_party/pyth/Dockerfile.pyth",
)
k8s_yaml_with_ns("./tilt_devnet/k8s/pyth.yaml")

k8s_resource(
    "pyth",
    resource_deps = ["solana-devnet"],
    labels = ["pyth"],
    trigger_mode = trigger_mode,
)

# pyth2wormhole client autoattester
docker_build(
    ref = "p2w-attest",
    context = ".",
    dockerfile = "./third_party/pyth/Dockerfile.p2w-attest",
)

k8s_yaml_with_ns("tilt_devnet/k8s/p2w-attest.yaml")
k8s_resource(
    "p2w-attest",
    resource_deps = ["solana-devnet", "pyth", "guardian"],
    port_forwards = [port_forward(3000, name = "metrics", host = webHost)],
    labels = ["pyth"],
    trigger_mode = trigger_mode,
)

# attestations checking script
docker_build(
    ref = "check-attestations",
    context = ".",
    only = ["./third_party"],
    dockerfile = "./third_party/pyth/Dockerfile.check-attestations",
)

k8s_yaml_with_ns("tilt_devnet/k8s/check-attestations.yaml")
k8s_resource(
    "check-attestations",
    resource_deps = ["pyth-price-server", "pyth", "p2w-attest"],
    labels = ["pyth"],
    trigger_mode = trigger_mode,
)

# Pyth2wormhole relay
docker_build(
    ref = "p2w-relay",
    context = ".",
    dockerfile = "third_party/pyth/p2w-relay/Dockerfile.pyth_relay",
)
k8s_yaml_with_ns("tilt_devnet/k8s/p2w-terra-relay.yaml")
k8s_resource(
    "p2w-terra-relay",
    resource_deps = ["pyth", "p2w-attest", "spy", "terra-terrad"],
    port_forwards = [
        port_forward(4200, name = "Rest API (Status + Query) [:4200]", host = webHost),
        port_forward(8081, name = "Prometheus [:8081]", host = webHost)],
    labels = ["pyth"]
)

k8s_yaml_with_ns("tilt_devnet/k8s/p2w-evm-relay.yaml")
k8s_resource(
    "p2w-evm-relay",
    resource_deps = ["pyth", "p2w-attest", "spy", "eth-devnet"],
    port_forwards = [
        port_forward(4201, container_port = 4200, name = "Rest API (Status + Query) [:4201]", host = webHost),
        port_forward(8082, container_port = 8081, name = "Prometheus [:8082]", host = webHost)],
    labels = ["pyth"]
)

# Pyth Price server
docker_build(
    ref = "pyth-price-server",
    context = ".",
    dockerfile = "price_service/server/Dockerfile",
)
k8s_yaml_with_ns("tilt_devnet/k8s/pyth-price-server.yaml")
k8s_resource(
    "pyth-price-server",
    resource_deps = ["pyth", "p2w-attest", "spy", "eth-devnet"],
    port_forwards = [
        port_forward(4202, container_port = 4200, name = "Rest API (Status + Query) [:4202]", host = webHost),
        port_forward(8083, container_port = 8081, name = "Prometheus [:8083]", host = webHost)],
    labels = ["pyth"]
)

k8s_yaml_with_ns("tilt_devnet/k8s/eth-devnet.yaml")

k8s_resource(
    "eth-devnet",
    port_forwards = [
        port_forward(8545, name = "Ganache RPC [:8545]", host = webHost),
    ],
    labels = ["evm"],
    trigger_mode = trigger_mode,
)

k8s_resource(
    "eth-devnet2",
    port_forwards = [
        port_forward(8546, name = "Ganache RPC [:8546]", host = webHost),
    ],
    labels = ["evm"],
    trigger_mode = trigger_mode,
)


# terra devnet

docker_build(
    ref = "terra-image",
    context = "./target_chains/cosmwasm/devnet",
    dockerfile = "./target_chains/cosmwasm/devnet/Dockerfile",
)

docker_build(
    ref = "cosmwasm-contracts",
    context = ".",
    dockerfile = "tilt_devnet/docker_images/Dockerfile.cosmwasm",
)

k8s_yaml_with_ns("tilt_devnet/k8s/terra-devnet.yaml")

k8s_resource(
    "terra-terrad",
    port_forwards = [
        port_forward(26657, name = "Terra RPC [:26657]", host = webHost),
        port_forward(1317, name = "Terra LCD [:1317]", host = webHost),
    ],
    labels = ["terra"],
    trigger_mode = trigger_mode,
)

k8s_resource(
    "terra-postgres",
    labels = ["terra"],
    trigger_mode = trigger_mode,
)

k8s_resource(
    "terra-fcd",
    resource_deps = ["terra-terrad", "terra-postgres"],
    port_forwards = [port_forward(3060, name = "Terra FCD [:3060]", host = webHost)],
    labels = ["terra"],
    trigger_mode = trigger_mode,
)

docker_build(
    ref = "prometheus",
    context = ".",
    dockerfile = "tilt_devnet/docker_images/Dockerfile.prometheus",
)

k8s_yaml_with_ns("tilt_devnet/k8s/prometheus.yaml")

k8s_resource(
    "prometheus",
    port_forwards = [port_forward(9090, name = "Prometheus dashboard", host = webHost)],
    labels = ["prometheus"],
    trigger_mode = trigger_mode,
)

docker_build(
    ref = "multisig",
    context = ".",
    dockerfile = "tilt_devnet/docker_images/Dockerfile.multisig",
)

k8s_yaml_with_ns("tilt_devnet/k8s/multisig.yaml")

k8s_resource(
    "multisig",
    resource_deps = ["solana-devnet"],
    labels = ["solana"],
    trigger_mode = trigger_mode,
)
