FROM cosmwasm/workspace-optimizer:0.12.11

ADD target_chains/cosmwasm/ /code
ADD wormhole_attester /wormhole_attester
ADD pythnet /pythnet
RUN optimize_workspace.sh