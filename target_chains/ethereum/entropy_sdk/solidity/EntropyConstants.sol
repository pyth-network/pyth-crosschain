// SPDX-License-Identifier: Apache 2

library EntropyStatusConstants {
    // Status values for Request.status //
    // not a request with callback
    uint8 public constant CALLBACK_NOT_NECESSARY = 0;
    // A request with callback where the callback hasn't been invoked yet.
    uint8 public constant CALLBACK_NOT_STARTED = 1;
    // A request with callback where the callback is currently in flight (this state is a reentry guard).
    uint8 public constant CALLBACK_IN_PROGRESS = 2;
    // A request with callback where the callback has been invoked and failed.
    uint8 public constant CALLBACK_FAILED = 3;
}
