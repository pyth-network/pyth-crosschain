#!/bin/bash

MYDIR=$(realpath "$(dirname "$0")")
cd "$MYDIR" || exit

HAS_INIT=false
HAS_DETACH=false

while [[ $# -gt 0 ]]
do
  case "$1" in
    -i|--init)
      HAS_INIT=true
      shift
      ;;
    -d|--detach)
      HAS_DETACH=true
      shift
      ;;
    -q|--quit)
      NITRO_CONTAINERS=$(docker container ls -q --filter name=nitro-testnode)

      if [ -z "$NITRO_CONTAINERS" ]; then
          echo "No nitro-testnode containers running"
      else
          docker container stop $NITRO_CONTAINERS || exit
      fi

      exit 0
      ;;
    *)
      echo "OPTIONS:"
      echo "-i|--init:         clone repo and init nitro test node"
      echo "-d|--detach:       setup nitro test node in detached mode"
      echo "-q|--quit:         shutdown nitro test node docker containers"
      exit 0
      ;;
  esac
done

TEST_NODE_DIR="$MYDIR/../nitro-testnode"
if [ ! -d "$TEST_NODE_DIR" ]; then
  HAS_INIT=true
fi

if $HAS_INIT
then
  cd "$MYDIR" || exit
  cd ..

  git clone --recurse-submodules https://github.com/OffchainLabs/nitro-testnode.git
  cd ./nitro-testnode || exit
  git pull origin release --recurse-submodules
  git checkout af851769d52cab38bc3733dbd0a4db6120fa7864 || exit

  ./test-node.bash --no-run --init || exit
fi


cd "$TEST_NODE_DIR" || exit
if $HAS_DETACH
then
  ./test-node.bash --detach
else
  ./test-node.bash
fi
