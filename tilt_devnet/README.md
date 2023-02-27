# Tilt Devnet

We use Tilt to run integration tests. These tests instantiate docker containers with all of the
various blockchains and services in order to verify that they interoperate correctly.

## Installation

The following dependencies are required for local development:

- [Go](https://golang.org/dl/) >= 1.17.5
- [Tilt](http://tilt.dev/) >= 0.20.8
- Any of the local Kubernetes clusters supported by Tilt.
  We strongly recommend [minikube](https://kubernetes.io/docs/setup/learning-environment/minikube/) >=
  v1.21.0 .
  - Tilt will use Minikube's embedded Docker server. If Minikube is not used, a local instance of
    [Docker](https://docs.docker.com/engine/install/) / moby-engine >= 19.03 is required.

See the [Tilt docs](https://docs.tilt.dev/install.html) docs on how to set up your local cluster -
it won't take more than a few minutes to set up! Example minikube invocation, adjust limits as needed:

    minikube start --cpus=8 --memory=8G --disk-size=50G --driver=docker

npm wants to set up an insane number of inotify watches in the web container which may exceed kernel limits.
The minikube default is too low, adjust it like this:

    minikube ssh 'echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf && sudo sysctl -p'

This should work on Linux, MacOS and Windows.

By default, the devnet is deployed to the `wormhole` namespace rather than `default`. This makes it easy to clean up the
entire deployment by simply removing the namespace, which isn't possible with `default`. Change your default namespace
to avoid having to specify `-n wormhole` for all commands:

    kubectl config set-context --current --namespace=wormhole

After installing all dependencies, just run `tilt up`.
Whenever you modify a file, the devnet is automatically rebuilt and a rolling update is done.

Launch the devnet while specifying the number of guardians nodes to run (default is five):

    tilt up -- --num=1

If you want to work on non-consensus parts of the code, running with a single guardian is easiest since
you won't have to wait for k8s to restart all pods.

## Usage

Watch pod status in your cluster:

    kubectl get pod -A -w

Get logs for single guardian node:

    kubectl logs guardian-0

Restart a specific pod:

    kubectl delete pod guardian-0

Adjust number of nodes in running cluster: (this is only useful if you want to test scenarios where the number
of nodes diverges from the guardian set - otherwise, `tilt down --delete-namespaces` and restart the cluster)

    tilt args -- --num=2

Tear down cluster:

    tilt down --delete-namespaces

Once you're done, press Ctrl-C. Run `tilt down` to tear down the devnet.

## Getting started on a development VM

This tutorial assumes a clean Debian >=10 VM. We recommend at least **16 vCPU, 64G of RAM and 500G of disk**.
Rust eats CPU for breakfast, so the more CPUs, the nicer your Solana compilation experience will be.

Install Git first:

    sudo apt-get install -y git

First, create an SSH key on the VM:

    ssh-keygen -t ed25519
    cat .ssh/id_ed25519.pub

You can then [add your public key on GitHub](https://github.com/settings/keys) and clone the repository:

    git clone git@github.com:certusone/wormhole.git

Configure your Git identity:

    git config --global user.name "Your Name"
    git config --global user.email "yourname@company.com"

Your email address should be linked to your personal or company GitHub account.

### Set up devnet on the VM

After cloning the repo, run the setup script. It expects to run as a regular user account with sudo permissions.
It installs Go, Minikube, Tilt and any other dependencies required for Wormhole development:

    cd wormhole
    scripts/dev-setup.sh

You then need to close and re-open your session to apply the new environment.
If you use ControlMaster SSH sessions, make sure to kill the session before reconnecting (`ssh -O exit hostname`).

Start a minikube session with recommended parameters:

    start-recommended-minikube

You can then run tilt normally (see above).

The easiest way to get access to the Tilt UI is to simply run Tilt on a public port, and use a firewall
of your choice to control access. For GCP, we ship a script that automatically runs `tilt up` on the right IP:

    scripts/tilt-gcp-up.sh

If something breaks, just run `minikube delete` and start from scratch by running `start-recommended-minikube`.
