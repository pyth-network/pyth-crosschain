# RpcPrice

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**conf** | **String** | The confidence interval associated with the price, stored as a string to avoid precision loss |
**expo** | **i32** | The exponent associated with both the price and confidence interval. Multiply those values by `10^expo` to get the real value. |
**price** | **String** | The price itself, stored as a string to avoid precision loss |
**publish_time** | **i64** | When the price was published. The `publish_time` is a unix timestamp, i.e., the number of seconds since the Unix epoch (00:00:00 UTC on 1 Jan 1970). |

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
