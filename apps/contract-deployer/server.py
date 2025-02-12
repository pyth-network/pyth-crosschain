from urllib.parse import urlparse
import streamlit as st
from git_utils import show_git_diff
from run_deploy_script import run_deploy_script
from update_files import update_files


def validate_inputs(chain_name: str, rpc_url: str) -> bool:
    if not chain_name:
        st.error("Chain name cannot be empty")
        return False

    if not rpc_url:
        st.error("RPC URL cannot be empty")
        return False

    # Validate URL format
    try:
        result = urlparse(rpc_url)
        if not all([result.scheme in ("http", "https"), result.netloc]):
            st.error("Invalid RPC URL format. Please enter a valid HTTP/HTTPS URL")
            return False
    except:
        st.error("Invalid URL format")
        return False

    return True


def main():

    st.header("EVM Contract Deployer")

    with st.form("deploy_config", enter_to_submit=False):
        chain_name = st.text_input("Chain Name", placeholder="e.g. Ethereum, Sepolia")
        rpc_url = st.text_input("RPC URL", placeholder="https://...")
        is_mainnet = st.checkbox("Is Mainnet?", value=False)
        submitted = st.form_submit_button("🚀 Deploy Contracts and Generate PR")

    if submitted:
        try:
            if not validate_inputs(chain_name, rpc_url):
                return

            update_files(is_mainnet, chain_name, rpc_url)
            # show_git_diff()
            run_deploy_script(chain_name)

        except Exception as e:
            st.error(f"An unexpected error occurred: {e}")


if __name__ == "__main__":
    # Enable running the app without `streamlit run`
    # https://github.com/streamlit/streamlit/issues/9450#issuecomment-2386348596
    if "__streamlitmagic__" not in locals():
        import streamlit.web.bootstrap

        streamlit.web.bootstrap.run(__file__, False, [], {})
    main()
