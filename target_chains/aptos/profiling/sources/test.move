script {
    use pyth::pyth;


    fun main(src: &signer, payload:vector<u8>) {
        let payload:vector<vector<u8>> = vector[payload];
        pyth::update_price_feeds_with_funder(src,payload);
    }
}
