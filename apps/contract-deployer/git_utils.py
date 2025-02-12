from git import Repo
import streamlit as st


def show_git_diff():
    """
    Shows the current git diff in the working directory.
    Returns the diff as a string or None if there are no changes.
    """
    try:
        # Get git diff using GitPython
        repo = Repo(".")
        diff = repo.git.diff()

        if diff:
            st.write(diff)
            return diff
        else:
            st.error("Failed to show git diff")
            return None

    except Exception as e:
        st.error(f"Error getting git diff: {e}")
        return None
