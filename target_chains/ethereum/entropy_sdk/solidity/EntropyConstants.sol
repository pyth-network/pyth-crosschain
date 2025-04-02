library EntropyConstants {
    // Status values for Request.status //
    // not a request with callback
    uint8 public constant STATUS_NO_CALLBACK = 0;
    // A request with callback where the callback hasn't been invoked yet.
    uint8 public constant STATUS_CALLBACK_NOT_STARTED = 1;
    // A request with callback where the callback is currently in flight (this state is a reentry guard).
    uint8 public constant STATUS_CALLBACK_IN_PROGRESS = 2;
    // A request with callback where the callback has been invoked and failed.
    uint8 public constant STATUS_CALLBACK_FAILED = 3;
}
