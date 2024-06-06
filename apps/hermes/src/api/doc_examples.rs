use crate::state::aggregate::UnixTimestamp;

// Example values for the utoipa API docs.
// Note that each of these expressions is only evaluated once when the documentation is created,
// so the examples don't auto-update over time. We may want to adjust these examples for
// stable/beta in the future so that the example values in the docs work for both hermes and hermes-beta.
// (Currently all example values are for stable.)

/// Example value for a price feed id
pub fn price_feed_id_example() -> &'static str {
    "e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43"
}

/// Example value for a unix timestamp
pub fn timestamp_example() -> UnixTimestamp {
    const STATIC_UNIX_TIMESTAMP: UnixTimestamp = 1717632000; // Thursday, 6 June 2024 00:00:00 GMT
    STATIC_UNIX_TIMESTAMP
}

/// Example value for a VAA
pub fn vaa_example() -> &'static str {
    "UE5BVQEAAAADuAEAAAADDQC1H7meY5fTed0FsykIb8dt+7nKpbuzfvU2DplDi+dcUl8MC+UIkS65+rkiq+zmNBxE2gaxkBkjdIicZ/fBo+X7AAEqp+WtlWb84np8jJfLpuQ2W+l5KXTigsdAhz5DyVgU3xs+EnaIZxBwcE7EKzjMam+V9rlRy0CGsiQ1kjqqLzfAAQLsoVO0Vu5gVmgc8XGQ7xYhoz36rsBgMjG+e3l/B01esQi/KzPuBf/Ar8Sg5aSEOvEU0muSDb+KIr6d8eEC+FtcAAPZEaBSt4ysXVL84LUcJemQD3SiG30kOfUpF8o7/wI2M2Jf/LyCsbKEQUyLtLbZqnJBSfZJR5AMsrnHDqngMLEGAAY4UDG9GCpRuPvg8hOlsrXuPP3zq7yVPqyG0SG+bNo8rEhP5b1vXlHdG4bZsutX47d5VZ6xnFROKudx3T3/fnWUAQgAU1+kUFc3e0ZZeX1dLRVEryNIVyxMQIcxWwdey+jlIAYowHRM0fJX3Scs80OnT/CERwh5LMlFyU1w578NqxW+AQl2E/9fxjgUTi8crOfDpwsUsmOWw0+Q5OUGhELv/2UZoHAjsaw9OinWUggKACo4SdpPlHYldoWF+J2yGWOW+F4iAQre4c+ocb6a9uSWOnTldFkioqhd9lhmV542+VonCvuy4Tu214NP+2UNd/4Kk3KJCf3iziQJrCBeLi1cLHdLUikgAQtvRFR/nepcF9legl+DywAkUHi5/1MNjlEQvlHyh2XbMiS85yu7/9LgM6Sr+0ukfZY5mSkOcvUkpHn+T+Nw/IrQAQ7lty5luvKUmBpI3ITxSmojJ1aJ0kj/dc0ZcQk+/qo0l0l3/eRLkYjw5j+MZKA8jEubrHzUCke98eSoj8l08+PGAA+DAKNtCwNZe4p6J1Ucod8Lo5RKFfA84CPLVyEzEPQFZ25U9grUK6ilF4GhEia/ndYXLBt3PGW3qa6CBBPM7rH3ABGAyYEtUwzB4CeVedA5o6cKpjRkIebqDNSOqltsr+w7kXdfFVtsK2FMGFZNt5rbpIR+ppztoJ6eOKHmKmi9nQ99ARKkTxRErOs9wJXNHaAuIRV38o1pxRrlQRzGsRuKBqxcQEpC8OPFpyKYcp6iD5l7cO/gRDTamLFyhiUBwKKMP07FAWTEJv8AAAAAABrhAfrtrFhR4yubI7X5QRqMK6xKrj7U3XuBHdGnLqSqcQAAAAAAGp0GAUFVV1YAAAAAAAUYUmIAACcQBsfKUtr4PgZbIXRxRESU79PjE4IBAFUA5i32yLSoX+GmfbRNwS3l2zMPesZrctxliv7fD0pBW0MAAAKqqMJFwAAAAAAqE/NX////+AAAAABkxCb7AAAAAGTEJvoAAAKqIcWxYAAAAAAlR5m4CP/mPsh1IezjYpDlJ4GRb5q4fTs2LjtyO6M0XgVimrIQ4kSh1qg7JKW4gbGkyRntVFR9JO/GNd3FPDit0BK6M+JzXh/h12YNCz9wxlZTvXrNtWNbzqT+91pvl5cphhSPMfAHyEzTPaGR9tKDy9KNu56pmhaY32d2vfEWQmKo22guegeR98oDxs67MmnUraco46a3zEnac2Bm80pasUgMO24="
}
