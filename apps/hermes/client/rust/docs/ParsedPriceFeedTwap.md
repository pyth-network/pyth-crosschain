# ParsedPriceFeedTwap

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**down_slots_ratio** | **String** | The % of slots where the network was down over the TWAP window. A value of zero indicates no slots were missed over the window, and a value of one indicates that every slot was missed over the window. This is a float value stored as a string to avoid precision loss. |
**end_timestamp** | **i64** | The end unix timestamp of the window |
**id** | **String** |  |
**start_timestamp** | **i64** | The start unix timestamp of the window |
**twap** | [**models::RpcPrice**](RpcPrice.md) |  |

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
