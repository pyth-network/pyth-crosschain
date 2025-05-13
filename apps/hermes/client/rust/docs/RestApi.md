# \RestApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**get_price_feed**](RestApi.md#get_price_feed) | **GET** /api/get_price_feed | **Deprecated: use /v2/updates/price/{publish_time} instead**
[**get_vaa**](RestApi.md#get_vaa) | **GET** /api/get_vaa | **Deprecated: use /v2/updates/price/{publish_time} instead**
[**get_vaa_ccip**](RestApi.md#get_vaa_ccip) | **GET** /api/get_vaa_ccip | **Deprecated: use /v2/updates/price/{publish_time} instead**
[**latest_price_feeds**](RestApi.md#latest_price_feeds) | **GET** /api/latest_price_feeds | **Deprecated: use /v2/updates/price/latest instead**
[**latest_price_updates**](RestApi.md#latest_price_updates) | **GET** /v2/updates/price/latest | Get the latest price updates by price feed id.
[**latest_publisher_stake_caps**](RestApi.md#latest_publisher_stake_caps) | **GET** /v2/updates/publisher_stake_caps/latest | Get the most recent publisher stake caps update data.
[**latest_twaps**](RestApi.md#latest_twaps) | **GET** /v2/updates/twap/{window_seconds}/latest | Get the latest TWAP by price feed id with a custom time window.
[**latest_vaas**](RestApi.md#latest_vaas) | **GET** /api/latest_vaas | **Deprecated: use /v2/updates/price/latest instead**
[**price_feed_ids**](RestApi.md#price_feed_ids) | **GET** /api/price_feed_ids | **Deprecated: use /v2/price_feeds instead**
[**price_feeds_metadata**](RestApi.md#price_feeds_metadata) | **GET** /v2/price_feeds | Get the set of price feeds.
[**price_stream_sse_handler**](RestApi.md#price_stream_sse_handler) | **GET** /v2/updates/price/stream | SSE route handler for streaming price updates.
[**timestamp_price_updates**](RestApi.md#timestamp_price_updates) | **GET** /v2/updates/price/{publish_time} | Get the latest price updates by price feed id.



## get_price_feed

> models::RpcPriceFeed get_price_feed(id, publish_time, verbose, binary)
**Deprecated: use /v2/updates/price/{publish_time} instead**

**Deprecated: use /v2/updates/price/{publish_time} instead**  Get a price update for a price feed with a specific timestamp  Given a price feed id and timestamp, retrieve the Pyth price update closest to that timestamp.

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**id** | **String** | The id of the price feed to get an update for. | [required] |
**publish_time** | **i64** | The unix timestamp in seconds. This endpoint will return the first update whose publish_time is >= the provided value. | [required] |
**verbose** | Option<**bool**> | If true, include the `metadata` field in the response with additional metadata about the price update. |  |
**binary** | Option<**bool**> | If true, include the binary price update in the `vaa` field of each returned feed. This binary data can be submitted to Pyth contracts to update the on-chain price. |  |

### Return type

[**models::RpcPriceFeed**](RpcPriceFeed.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## get_vaa

> models::GetVaaResponse get_vaa(id, publish_time)
**Deprecated: use /v2/updates/price/{publish_time} instead**

**Deprecated: use /v2/updates/price/{publish_time} instead**  Get a VAA for a price feed with a specific timestamp  Given a price feed id and timestamp, retrieve the Pyth price update closest to that timestamp.

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**id** | **String** | The ID of the price feed to get an update for. | [required] |
**publish_time** | **i64** | The unix timestamp in seconds. This endpoint will return the first update whose publish_time is >= the provided value. | [required] |

### Return type

[**models::GetVaaResponse**](GetVaaResponse.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json, text/plain

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## get_vaa_ccip

> models::GetVaaCcipResponse get_vaa_ccip(data)
**Deprecated: use /v2/updates/price/{publish_time} instead**

**Deprecated: use /v2/updates/price/{publish_time} instead**  Get a VAA for a price feed using CCIP  This endpoint accepts a single argument which is a hex-encoded byte string of the following form: `<price feed id (32 bytes> <publish time as unix timestamp (8 bytes, big endian)>`

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**data** | **std::path::PathBuf** |  | [required] |

### Return type

[**models::GetVaaCcipResponse**](GetVaaCcipResponse.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## latest_price_feeds

> Vec<models::RpcPriceFeed> latest_price_feeds(ids_left_square_bracket_right_square_bracket, verbose, binary)
**Deprecated: use /v2/updates/price/latest instead**

**Deprecated: use /v2/updates/price/latest instead**  Get the latest price updates by price feed id.  Given a collection of price feed ids, retrieve the latest Pyth price for each price feed.

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**ids_left_square_bracket_right_square_bracket** | [**Vec<String>**](String.md) | Get the most recent price update for this set of price feed ids.  This parameter can be provided multiple times to retrieve multiple price updates, for example see the following query string:  ``` ?ids[]=a12...&ids[]=b4c... ``` | [required] |
**verbose** | Option<**bool**> | If true, include the `metadata` field in the response with additional metadata about the price update. |  |
**binary** | Option<**bool**> | If true, include the binary price update in the `vaa` field of each returned feed. This binary data can be submitted to Pyth contracts to update the on-chain price. |  |

### Return type

[**Vec<models::RpcPriceFeed>**](RpcPriceFeed.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## latest_price_updates

> models::PriceUpdate latest_price_updates(ids_left_square_bracket_right_square_bracket, encoding, parsed, ignore_invalid_price_ids)
Get the latest price updates by price feed id.

Get the latest price updates by price feed id.  Given a collection of price feed ids, retrieve the latest Pyth price for each price feed.

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**ids_left_square_bracket_right_square_bracket** | [**Vec<String>**](String.md) | Get the most recent price update for this set of price feed ids.  This parameter can be provided multiple times to retrieve multiple price updates, for example see the following query string:  ``` ?ids[]=a12...&ids[]=b4c... ``` | [required] |
**encoding** | Option<[**EncodingType**](.md)> | Optional encoding type. If true, return the price update in the encoding specified by the encoding parameter. Default is `hex`. |  |
**parsed** | Option<**bool**> | If true, include the parsed price update in the `parsed` field of each returned feed. Default is `true`. |  |
**ignore_invalid_price_ids** | Option<**bool**> | If true, invalid price IDs in the `ids` parameter are ignored. Only applicable to the v2 APIs. Default is `false`. |  |

### Return type

[**models::PriceUpdate**](PriceUpdate.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json, text/plain

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## latest_publisher_stake_caps

> models::LatestPublisherStakeCapsUpdateDataResponse latest_publisher_stake_caps(encoding, parsed)
Get the most recent publisher stake caps update data.

Get the most recent publisher stake caps update data.

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**encoding** | Option<[**EncodingType**](.md)> | Get the most recent publisher stake caps update data. Optional encoding type. If true, return the message in the encoding specified by the encoding parameter. Default is `hex`. |  |
**parsed** | Option<**bool**> | If true, include the parsed update in the `parsed` field of each returned feed. Default is `true`. |  |

### Return type

[**models::LatestPublisherStakeCapsUpdateDataResponse**](LatestPublisherStakeCapsUpdateDataResponse.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## latest_twaps

> models::TwapsResponse latest_twaps(window_seconds, ids_left_square_bracket_right_square_bracket, encoding, parsed, ignore_invalid_price_ids)
Get the latest TWAP by price feed id with a custom time window.

Get the latest TWAP by price feed id with a custom time window.  Given a collection of price feed ids, retrieve the latest Pyth TWAP price for each price feed.

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**window_seconds** | **i64** | The time window in seconds over which to calculate the TWAP, ending at the current time. For example, a value of 300 would return the most recent 5 minute TWAP. Must be greater than 0 and less than or equal to 600 seconds (10 minutes). | [required] |
**ids_left_square_bracket_right_square_bracket** | [**Vec<String>**](String.md) | Get the most recent TWAP (time weighted average price) for this set of price feed ids. The `binary` data contains the signed start & end cumulative price updates needed to calculate the TWAPs on-chain. The `parsed` data contains the calculated TWAPs.  This parameter can be provided multiple times to retrieve multiple price updates, for example see the following query string:  ``` ?ids[]=a12...&ids[]=b4c... ``` | [required] |
**encoding** | Option<[**EncodingType**](.md)> | Optional encoding type. If true, return the cumulative price updates in the encoding specified by the encoding parameter. Default is `hex`. |  |
**parsed** | Option<**bool**> | If true, include the calculated TWAP in the `parsed` field of each returned feed. Default is `true`. |  |
**ignore_invalid_price_ids** | Option<**bool**> | If true, invalid price IDs in the `ids` parameter are ignored. Only applicable to the v2 APIs. Default is `false`. |  |

### Return type

[**models::TwapsResponse**](TwapsResponse.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json, text/plain

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## latest_vaas

> Vec<String> latest_vaas(ids_left_square_bracket_right_square_bracket)
**Deprecated: use /v2/updates/price/latest instead**

**Deprecated: use /v2/updates/price/latest instead**  Get VAAs for a set of price feed ids.  Given a collection of price feed ids, retrieve the latest VAA for each. The returned VAA(s) can be submitted to the Pyth contract to update the on-chain price. If VAAs are not found for every provided price ID the call will fail.

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**ids_left_square_bracket_right_square_bracket** | [**Vec<String>**](String.md) | Get the VAAs for this set of price feed ids.  This parameter can be provided multiple times to retrieve multiple price updates, for example see the following query string:  ``` ?ids[]=a12...&ids[]=b4c... ``` | [required] |

### Return type

**Vec<String>**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## price_feed_ids

> Vec<String> price_feed_ids()
**Deprecated: use /v2/price_feeds instead**

**Deprecated: use /v2/price_feeds instead**  Get the set of price feed IDs.  This endpoint fetches all of the price feed IDs for which price updates can be retrieved.

### Parameters

This endpoint does not need any parameter.

### Return type

**Vec<String>**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## price_feeds_metadata

> Vec<models::PriceFeedMetadata> price_feeds_metadata(query, asset_type)
Get the set of price feeds.

Get the set of price feeds.  This endpoint fetches all price feeds from the Pyth network. It can be filtered by asset type and query string.

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**query** | Option<**String**> | Optional query parameter. If provided, the results will be filtered to all price feeds whose symbol contains the query string. Query string is case insensitive. |  |
**asset_type** | Option<[**models::AssetType**](.md)> | Optional query parameter. If provided, the results will be filtered by asset type. Possible values are crypto, equity, fx, metal, rates. Filter string is case insensitive. |  |

### Return type

[**Vec<models::PriceFeedMetadata>**](PriceFeedMetadata.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## price_stream_sse_handler

> models::PriceUpdate price_stream_sse_handler(ids_left_square_bracket_right_square_bracket, encoding, parsed, allow_unordered, benchmarks_only, ignore_invalid_price_ids)
SSE route handler for streaming price updates.

SSE route handler for streaming price updates.  The connection will automatically close after 24 hours to prevent resource leaks. Clients should implement reconnection logic to maintain continuous price updates.

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**ids_left_square_bracket_right_square_bracket** | [**Vec<String>**](String.md) | Get the most recent price update for this set of price feed ids.  This parameter can be provided multiple times to retrieve multiple price updates, for example see the following query string:  ``` ?ids[]=a12...&ids[]=b4c... ``` | [required] |
**encoding** | Option<[**EncodingType**](.md)> | Optional encoding type. If true, return the price update in the encoding specified by the encoding parameter. Default is `hex`. |  |
**parsed** | Option<**bool**> | If true, include the parsed price update in the `parsed` field of each returned feed. Default is `true`. |  |
**allow_unordered** | Option<**bool**> | If true, allows unordered price updates to be included in the stream. |  |
**benchmarks_only** | Option<**bool**> | If true, only include benchmark prices that are the initial price updates at a given timestamp (i.e., prevPubTime != pubTime). |  |
**ignore_invalid_price_ids** | Option<**bool**> | If true, invalid price IDs in the `ids` parameter are ignored. Only applicable to the v2 APIs. Default is `false`. |  |

### Return type

[**models::PriceUpdate**](PriceUpdate.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json, text/plain

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## timestamp_price_updates

> models::PriceUpdate timestamp_price_updates(publish_time, ids_left_square_bracket_right_square_bracket, encoding, parsed, ignore_invalid_price_ids)
Get the latest price updates by price feed id.

Get the latest price updates by price feed id.  Given a collection of price feed ids, retrieve the latest Pyth price for each price feed.

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**publish_time** | **i64** | The unix timestamp in seconds. This endpoint will return the first update whose publish_time is >= the provided value. | [required] |
**ids_left_square_bracket_right_square_bracket** | [**Vec<String>**](String.md) | Get the most recent price update for this set of price feed ids.  This parameter can be provided multiple times to retrieve multiple price updates, for example see the following query string:  ``` ?ids[]=a12...&ids[]=b4c... ``` | [required] |
**encoding** | Option<[**EncodingType**](.md)> | Optional encoding type. If true, return the price update in the encoding specified by the encoding parameter. Default is `hex`. |  |
**parsed** | Option<**bool**> | If true, include the parsed price update in the `parsed` field of each returned feed. Default is `true`. |  |
**ignore_invalid_price_ids** | Option<**bool**> | If true, invalid price IDs in the `ids` parameter are ignored. Only applicable to the v2 APIs. Default is `false`. |  |

### Return type

[**models::PriceUpdate**](PriceUpdate.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json, text/plain

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)
