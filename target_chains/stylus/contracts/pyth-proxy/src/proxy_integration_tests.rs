#[cfg(test)]
mod proxy_integration_tests {
    use crate::Proxy;
    use alloy_primitives::{address, Address};
    use motsu::prelude::*;

    const OWNER: Address = address!("beFA429d57cD18b7F8A4d91A2da9AB4AF05d0FBe");
    const IMPLEMENTATION: Address = address!("1234567890123456789012345678901234567890");
    const NON_OWNER: Address = address!("abcdefabcdefabcdefabcdefabcdefabcdefabcd");

    #[motsu::test]
    fn test_proxy_initialization(proxy: Contract<Proxy>, alice: Address) {
        let result = proxy.sender(OWNER).init(OWNER);
        assert!(result.is_ok(), "Initialization should succeed");
        
        let owner = proxy.sender(alice).get_owner();
        assert_eq!(owner, OWNER, "Owner should be set correctly");
    }

    #[motsu::test]
    fn test_proxy_double_initialization_fails(proxy: Contract<Proxy>, alice: Address) {
        let result1 = proxy.sender(OWNER).init(OWNER);
        assert!(result1.is_ok(), "First initialization should succeed");
        
        let result2 = proxy.sender(OWNER).init(OWNER);
        assert!(result2.is_err(), "Second initialization should fail");
    }

    #[motsu::test]
    fn test_set_implementation_by_owner(proxy: Contract<Proxy>, alice: Address) {
        proxy.sender(OWNER).init(OWNER).unwrap();
        
        let result = proxy.sender(OWNER).set_implementation(IMPLEMENTATION);
        assert!(result.is_ok(), "Owner should be able to set implementation");
        
        let impl_result = proxy.sender(alice).get_implementation();
        assert!(impl_result.is_ok(), "Should be able to get implementation");
        assert_eq!(impl_result.unwrap(), IMPLEMENTATION, "Implementation should be set correctly");
    }

    #[motsu::test]
    fn test_set_implementation_by_non_owner_fails(proxy: Contract<Proxy>, alice: Address) {
        proxy.sender(OWNER).init(OWNER).unwrap();
        
        let result = proxy.sender(NON_OWNER).set_implementation(IMPLEMENTATION);
        assert!(result.is_err(), "Non-owner should not be able to set implementation");
    }

    #[motsu::test]
    fn test_set_zero_implementation_fails(proxy: Contract<Proxy>, alice: Address) {
        proxy.sender(OWNER).init(OWNER).unwrap();
        
        let result = proxy.sender(OWNER).set_implementation(Address::ZERO);
        assert!(result.is_err(), "Should not be able to set zero address as implementation");
    }

    #[motsu::test]
    fn test_get_implementation_when_not_set(proxy: Contract<Proxy>, alice: Address) {
        proxy.sender(OWNER).init(OWNER).unwrap();
        
        let result = proxy.sender(alice).get_implementation();
        assert!(result.is_err(), "Should fail when implementation is not set");
    }

    #[motsu::test]
    fn test_relay_without_implementation_fails(proxy: Contract<Proxy>, alice: Address) {
        proxy.sender(OWNER).init(OWNER).unwrap();
        
        let result = proxy.sender(OWNER).relay_to_implementation(vec![1, 2, 3]);
        assert!(result.is_err(), "Relay should fail when no implementation is set");
    }

    #[motsu::test]
    fn test_proxy_ownership_control(proxy: Contract<Proxy>, alice: Address) {
        proxy.sender(OWNER).init(OWNER).unwrap();
        
        let result1 = proxy.sender(OWNER).set_implementation(IMPLEMENTATION);
        assert!(result1.is_ok(), "Owner should be able to set implementation");
        
        let result2 = proxy.sender(NON_OWNER).set_implementation(address!("9999999999999999999999999999999999999999"));
        assert!(result2.is_err(), "Non-owner should not be able to change implementation");
    }
}
