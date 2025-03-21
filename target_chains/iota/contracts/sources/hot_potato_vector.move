/// This class represents a vector of objects wrapped
/// inside of a hot potato struct.
module pyth::hot_potato_vector {
    use std::vector;

    friend pyth::pyth;
    #[test_only]
    friend pyth::pyth_tests;

    // A hot potato containing a vector of elements
    struct HotPotatoVector<T: copy + drop> {
        contents: vector<T>
    }

    // A public destroy function.
    public fun destroy<T: copy + drop>(hot_potato_vector: HotPotatoVector<T>) {
        let HotPotatoVector { contents: _ } = hot_potato_vector;
    }

    // Only certain on-chain functions are allowed to create a new hot potato vector.
    public(friend) fun new<T: copy + drop>(vec: vector<T>): HotPotatoVector<T> {
        HotPotatoVector {
            contents: vec
        }
    }

    public fun length<T: copy + drop>(potato: &HotPotatoVector<T>): u64 {
        vector::length(&potato.contents)
    }

    public fun is_empty<T: copy + drop>(potato: &HotPotatoVector<T>): bool {
        vector::is_empty(&potato.contents)
    }

    public(friend) fun borrow<T: copy + drop>(potato: &HotPotatoVector<T>, i: u64): &T {
        vector::borrow<T>(&potato.contents, i)
    }

    public(friend) fun pop_back<T: copy + drop>(hot_potato_vector: HotPotatoVector<T>): (T, HotPotatoVector<T>) {
        let elem = vector::pop_back<T>(&mut hot_potato_vector.contents);
        return (elem, hot_potato_vector)
    }

    #[test_only]
    struct A has copy, drop {
        a: u64
    }

    #[test]
    fun test_hot_potato_vector() {
        let vec_of_a = vector::empty<A>();
        vector::push_back(&mut vec_of_a, A { a: 5 });
        vector::push_back(&mut vec_of_a, A { a: 11 });
        vector::push_back(&mut vec_of_a, A { a: 23 });

        let hot_potato = new<A>(vec_of_a);
        let (b, hot_potato) = pop_back<A>(hot_potato);
        assert!(b.a == 23, 0);
        (b, hot_potato) = pop_back<A>(hot_potato);
        assert!(b.a == 11, 0);
        let (b, hot_potato) = pop_back<A>(hot_potato);
        assert!(b.a == 5, 0);

        destroy<A>(hot_potato);
    }
}
