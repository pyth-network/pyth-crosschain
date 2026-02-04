class StaleConnectionError(Exception):
    """Raised when a websocket connection becomes stale due to inactivity."""

    pass


class PushError(Exception):
    """Raised when all push endpoints fail to accept an oracle update."""

    pass
