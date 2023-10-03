script {
    use pyth::pyth;


    fun main(src: &signer) {
        let payload:vector<vector<u8>> = vector[vector[80, 78, 65, 85]];
        pyth::update_price_feeds_with_funder(src,payload);
    }
}
