/// A set data structure.
module pyth::set {
    use std::table::{Self, Table};
    use std::vector;

    /// Empty struct. Used as the value type in mappings to encode a set
    struct Unit has store, copy, drop {}

    /// A set containing elements of type `A` with support for membership
    /// checking.
    struct Set<A: copy + drop> has store {
        keys: vector<A>,
        elems: Table<A, Unit>
    }

    /// Create a new Set.
    public fun new<A: copy + drop>(): Set<A> {
        Set {
            keys: vector::empty<A>(),
            elems: table::new(),
        }
    }

    /// Add a new element to the set.
    /// Aborts if the element already exists
    public fun add<A: copy + drop>(set: &mut Set<A>, key: A) {
        table::add(&mut set.elems, key, Unit {});
        vector::push_back(&mut set.keys, key);
    }

    /// Returns true iff `set` contains an entry for `key`.
    public fun contains<A: copy + drop>(set: &Set<A>, key: A): bool {
        table::contains(&set.elems, key)
    }

    /// Removes all elements from the set
    public fun empty<A: copy + drop>(set: &mut Set<A>) {
        while (!vector::is_empty(&set.keys)) {
            table::remove(&mut set.elems, vector::pop_back(&mut set.keys));
        }
    }

    // TODO: destroy_empty, but this is tricky because std::table doesn't
    // have this functionality.
}
