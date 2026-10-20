import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet.js";
import type { HermesClient } from "@pythnetwork/hermes-client";
import { sliceAccumulatorUpdateData } from "@pythnetwork/price-service-sdk";
import { PythSolanaReceiver } from "@pythnetwork/pyth-solana-receiver";
import { Connection, Keypair, SystemProgram } from "@solana/web3.js";
import type { VersionedTransaction } from "@solana/web3.js-v3";
import type { Logger } from "pino";

import { SolanaPricePusher } from "../solana.js";

// A Hermes response for 20 crypto price feeds, recorded on 2026-10-20 from https://hermes.pyth.network/v2/updates/price/latest
const PRICE_FEED_IDS = [
  "e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
  "ff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace",
  "0bbf28e9a841a1cc788f6a361b17ca072d0ea3098a1e5df1c3922d06719579ff",
  "d69731a2e74ac1ce884fc3890f7ee324b6deb66147055249568869ed700882e4",
  "83dfac550d6066d5c837e99c27e38a392c5cccc9a637044c2ef6c843336da444",
  "ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d",
  "eaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a",
  "2b89b9dc8fdf9f34709a5b106b472f0f39bb6ca9ce04b0fd7f2e971688e2e53b",
  "72b021217ca3fe68922a19aaf990109cb9d84e9ad004b4d2025ad6f529314419",
  "4ca4beeca86f0d164160323817a4e42b10010a724c2217c6ee41b54cd4cc61fc",
  "23d7315113f5b1d3ba7a83604c44b94d79f4fd69af77f804fc7f920a6dc65744",
  "8963217838ab4cf5cadc172203c1f0b763fbaa45f346d8ee50ba994bbcac3026",
  "dcef50dd0a4cd2dcc17e45df1676dcb336a11a61c69df7a0299b0150c672d25c",
  "ec5d399846a9209f3fe5881d70aae9268c94339ff9817e8d18ff19fa05eea1c8",
  "2f95862b045670cd22bee3114c39763a4a08beeb663b145d283c31d7d1101c4f",
  "2a01deaec9e51a579277b34b122399984d0bbf57e2458a7e42fecd2829867a0d",
  "67aed5a24fdad045475e7195c98a98aea119c763f272d4523f5bac93a4f33c2b",
  "93da3352f9f1d105fdfe4971cfa80e9dd777bfc5d0f683ebb6e1294b92137bb7",
  "8ac0c70fff57e9aefdf5edf44b51d62c2d433653cbb2cf5cc06bb115af04d221",
  "f0d57deca57b3da2fe63a493f4c25925fdfd8edf834b20f93e1f84dbd1504d4a",
];

const PRICE_UPDATE_DATA =
  "UE5BVQEAAAABJAEAAAABAwAIuyozh4JxMmYPYh35JwklfuF07Wbz7jg29OtEXqF8yxCtDwaMF3HFiIwdQt6k4HsSR5EOQKQWyo20NvAz+CMmAAL74DdWSXdES5weVYEiRXhkWgH0zOxQom7r5hlK/mkOjHJGxavyZ3c1sMwexhHtrzc7dgOHdzMl68BVHE4LhPjbAQO2Omp2EFTsxFPydd1cPj9dZ17H162ynD/mif5PXju8am+B6JS7JcE63BH2IWUMYJNI/YT4AhsFJclWtQJ8bMFOAGrXhTAAAAAAABpQeXRobmV0UHl0aG5ldFB5dGhuZXRQeXRobmV0UHl0aAAAAAhY1mfAAEFVV1YAAAAACFjWZ8AAAAAAYAMALiFfqtE5PDvivlakVNaUicIUAFUA5i32yLSoX+GmfbRNwS3l2zMPesZrctxliv7fD0pBW0MAAAd6VW1lkQAAAAHFGPSd////+AAAAABq14UwAAAAAGrXhS8AAAeDbHETIAAAAAGE2yeoDNGkK6o1glLlxc+ABl3ERiqjU9LhAShWiV29XteAGPNUyrtkRQS+Q6yJnLquc6MU36Ym370yMch4siuiShhI2A+6CxZb8lbi/Yx0d2LIOPEi3YyiqPj4I+/1IZVMkRgfD0THNxxLXM/WlKA6mt3eWst1W2Y6j157wcpgK4J9ygGS+QiMMKXYZOrewbbgsOrUhDe/J4S5PCvd6onV27PPBqqlp1KJCqxCdZ7aqRFaUTjcBr1j0uXraZfwZs/PrVyVJfVNSsuApkpT+4S0imxUCX9uByyzIOKy8SzarbhF3w26W391iMnS9QNpm8eFX27AaQBVAP9hSRqTERLd8b2BR80bZBN1959YJRJtZlSAh0Y0/QrOAAAAOJwauQoAAAAADeBh4/////gAAAAAateFMAAAAABq14UvAAAAONCzPFwAAAAADTLW+gynern28CYGbwNXeGF/uATnJ1aufwEoVoldvV7XgBjzVMq7ZEUEvkOsiZy6rnOjFN+mJt+9MjHIeLIrokoYSNgPugsWW/JW4v2MdHdiyDjxIt2Moqj4+CPv9SGVTJEYHw9ExzccS1zP1pSgOprd3lrLdVtmOo9ee8HKYCuCfcoBkvkIjDCl2GTq3sG24LDq1IQ3vyeEuTwr3eqJ1duzzwaqpadSiQqsQnWe2qkRWlE43Aa9Y9Ll62mX8GbPz61clSX1TUrLgKZKU/uEtIpsVAl/bgcssyDisvEs2q24Rd8Nult/dYjJ0vUDaZvHhV9uwGkAVQALvyjpqEGhzHiPajYbF8oHLQ6jCYoeXfHDki0GcZV5/wAAAAAAc25/AAAAAAAAIPb////4AAAAAGrXhTAAAAAAateFLwAAAAAAdA/YAAAAAAAAELEMedwvkF4MLSFsvbuOYdVkKuN2ZbAF58jr4dA93U/Gaf1eXI/kFpg/w4mcuq5zoxTfpibfvTIxyHiyK6JKGEjYD7oLFlvyVuL9jHR3Ysg48SLdjKKo+Pgj7/UhlUyRGB8PRMc3HEtcz9aUoDqa3d5ay3VbZjqPXnvBymArgn3KAZL5CIwwpdhk6t7BtuCw6tSEN78nhLk8K93qidXbs88GqqWnUokKrEJ1ntqpEVpRONwGvWPS5etpl/Bmz8+tXJUl9U1Ky4CmSlP7hLSKbFQJf24HLLMg4rLxLNqtuEXfDbpbf3WIydL1A2mbx4VfbsBpAFUA1pcxoudKwc6IT8OJD37jJLbetmFHBVJJVohp7XAIguQAAAAAAACtDQAAAAAAAAAy////9gAAAABq14UwAAAAAGrXhS8AAAAAAACtMQAAAAAAAAAdDInS7AUeMfCu0bBWClD7VZwzt48DBefI6+HQPd1Pxmn9XlyP5BaYP8OJnLquc6MU36Ym370yMch4siuiShhI2A+6CxZb8lbi/Yx0d2LIOPEi3YyiqPj4I+/1IZVMkRgfD0THNxxLXM/WlKA6mt3eWst1W2Y6j157wcpgK4J9ygGS+QiMMKXYZOrewbbgsOrUhDe/J4S5PCvd6onV27PPBqqlp1KJCqxCdZ7aqRFaUTjcBr1j0uXraZfwZs/PrVyVJfVNSsuApkpT+4S0imxUCX9uByyzIOKy8SzarbhF3w26W391iMnS9QNpm8eFX27AaQBVAIPfrFUNYGbVyDfpnCfjijksXMzJpjcETC72yEMzbaREAAAAAAAK990AAAAAAAADd/////YAAAAAateFMAAAAABq14UvAAAAAAALEnQAAAAAAAABRAxvsCUWKSL7tvPVmD6JHaI0STYBDad31cWlICarNLXo39o0iKP4FEabnx9F7PlIbDEV2sfM8JfB2yA/cygYSNgPugsWW/JW4v2MdHdiyDjxIt2Moqj4+CPv9SGVTJEYHw9ExzccS1zP1pSgOprd3lrLdVtmOo9ee8HKYCuCfcoBkvkIjDCl2GTq3sG24LDq1IQ3vyeEuTwr3eqJ1duzzwaqpadSiQqsQnWe2qkRWlE43Aa9Y9Ll62mX8GbPz61clSX1TUrLgKZKU/uEtIpsVAl/bgcssyDisvEs2q24Rd8Nult/dYjJ0vUDaZvHhV9uwGkAVQDvDYtv2izrpB2hXUCV0do5Kg0vjtDGx7wPTPrIwoC1bQAAAAJzAuqaAAAAAACBnWb////4AAAAAGrXhTAAAAAAateFLwAAAAJ6MHvIAAAAAAAyC3MMptutPqtnJsxKORwVMGNbA+0W4G6nd9XFpSAmqzS16N/aNIij+BRGm58fRez5SGwxFdrHzPCXwdsgP3MoGEjYD7oLFlvyVuL9jHR3Ysg48SLdjKKo+Pgj7/UhlUyRGB8PRMc3HEtcz9aUoDqa3d5ay3VbZjqPXnvBymArgn3KAZL5CIwwpdhk6t7BtuCw6tSEN78nhLk8K93qidXbs88GqqWnUokKrEJ1ntqpEVpRONwGvWPS5etpl/Bmz8+tXJUl9U1Ky4CmSlP7hLSKbFQJf24HLLMg4rLxLNqtuEXfDbpbf3WIydL1A2mbx4VfbsBpAFUA6qAgxhzEeXEoE0Yc4VOJSpamwAsh7Qz8J5jR+anpyUoAAAAABfWUdgAAAAAAADNG////+AAAAABq14UwAAAAAGrXhS8AAAAABfWaWQAAAAAAAB3sDFfdMDQ3tQBilis8BiQDBGnOI4RqffvlhvMp8xfLZDhbLiJRiUChqBmfH0Xs+UhsMRXax8zwl8HbID9zKBhI2A+6CxZb8lbi/Yx0d2LIOPEi3YyiqPj4I+/1IZVMkRgfD0THNxxLXM/WlKA6mt3eWst1W2Y6j157wcpgK4J9ygGS+QiMMKXYZOrewbbgsOrUhDe/J4S5PCvd6onV27PPBqqlp1KJCqxCdZ7aqRFaUTjcBr1j0uXraZfwZs/PrVyVJfVNSsuApkpT+4S0imxUCX9uByyzIOKy8SzarbhF3w26W391iMnS9QNpm8eFX27AaQBVACuJudyP3580cJpbEGtHLw85u2ypzgSw/X8ulxaI4uU7AAAAAAX0IfwAAAAAAABL7f////gAAAAAateFMAAAAABq14UvAAAAAAXz/loAAAAAAAArWQz0JtZpb//u4w4yRN7ak10uyAOlJX375YbzKfMXy2Q4Wy4iUYlAoagZnx9F7PlIbDEV2sfM8JfB2yA/cygYSNgPugsWW/JW4v2MdHdiyDjxIt2Moqj4+CPv9SGVTJEYHw9ExzccS1zP1pSgOprd3lrLdVtmOo9ee8HKYCuCfcoBkvkIjDCl2GTq3sG24LDq1IQ3vyeEuTwr3eqJ1duzzwaqpadSiQqsQnWe2qkRWlE43Aa9Y9Ll62mX8GbPz61clSX1TUrLgKZKU/uEtIpsVAl/bgcssyDisvEs2q24Rd8Nult/dYjJ0vUDaZvHhV9uwGkAVQBysCEhfKP+aJIqGar5kBCcudhOmtAEtNICWtb1KTFEGQAAAAAAAHW2AAAAAAAAABX////2AAAAAGrXhTAAAAAAateFLwAAAAAAAHZQAAAAAAAAABcMT6/p1MMknYFFOJ9m5aOybZLb5HIeEXdGNp7A653tIzGjXmzz0VZDe/RhTmwuVD6tloupr5wv5vZnep7m+Atbp56JKjrg3cSKseOwgVP5rTXdjKKo+Pgj7/UhlUyRGB8PRMc3HEtcz9aUoDqa3d5ay3VbZjqPXnvBymArgn3KAZL5CIwwpdhk6t7BtuCw6tSEN78nhLk8K93qidXbs88GqqWnUokKrEJ1ntqpEVpRONwGvWPS5etpl/Bmz8+tXJUl9U1Ky4CmSlP7hLSKbFQJf24HLLMg4rLxLNqtuEXfDbpbf3WIydL1A2mbx4VfbsBpAFUATKS+7KhvDRZBYDI4F6TkKxABCnJMIhfG7kG1TNTMYfwAAAAAATcVBwAAAAAAADJ5////+AAAAABq14UwAAAAAGrXhS8AAAAAATohxgAAAAAAABceDJHAL5H13/CdfwHl+ha4VS+CQT+jHhF3RjaewOud7SMxo15s89FWQ3v0YU5sLlQ+rZaLqa+cL+b2Z3qe5vgLW6eeiSo64N3EirHjsIFT+a013YyiqPj4I+/1IZVMkRgfD0THNxxLXM/WlKA6mt3eWst1W2Y6j157wcpgK4J9ygGS+QiMMKXYZOrewbbgsOrUhDe/J4S5PCvd6onV27PPBqqlp1KJCqxCdZ7aqRFaUTjcBr1j0uXraZfwZs/PrVyVJfVNSsuApkpT+4S0imxUCX9uByyzIOKy8SzarbhF3w26W391iMnS9QNpm8eFX27AaQBVACPXMVET9bHTunqDYExEuU159P1pr3f4BPx/kgptxldEAAAAAAYGw+AAAAAAAAGjK/////gAAAAAateFMAAAAABq14UvAAAAAAYacJ4AAAAAAAFU6Aw0rzI+k0d1bJdrpwzg9LPRE72FR4deKD/HrHzJblmgpgBF9fVvjknB9GFObC5UPq2Wi6mvnC/m9md6nub4C1unnokqOuDdxIqx47CBU/mtNd2Moqj4+CPv9SGVTJEYHw9ExzccS1zP1pSgOprd3lrLdVtmOo9ee8HKYCuCfcoBkvkIjDCl2GTq3sG24LDq1IQ3vyeEuTwr3eqJ1duzzwaqpadSiQqsQnWe2qkRWlE43Aa9Y9Ll62mX8GbPz61clSX1TUrLgKZKU/uEtIpsVAl/bgcssyDisvEs2q24Rd8Nult/dYjJ0vUDaZvHhV9uwGkAVQCJYyF4OKtM9crcFyIDwfC3Y/uqRfNG2O5QuplLvKwwJgAAAAAH/JwiAAAAAAAB9aH////4AAAAAGrXhTAAAAAAateFLwAAAAAIEGMlAAAAAAABd50MkAIs4YWK8Xrz5/uUz40WmdPiQcCHXig/x6x8yW5ZoKYARfX1b45JwfRhTmwuVD6tloupr5wv5vZnep7m+Atbp56JKjrg3cSKseOwgVP5rTXdjKKo+Pgj7/UhlUyRGB8PRMc3HEtcz9aUoDqa3d5ay3VbZjqPXnvBymArgn3KAZL5CIwwpdhk6t7BtuCw6tSEN78nhLk8K93qidXbs88GqqWnUokKrEJ1ntqpEVpRONwGvWPS5etpl/Bmz8+tXJUl9U1Ky4CmSlP7hLSKbFQJf24HLLMg4rLxLNqtuEXfDbpbf3WIydL1A2mbx4VfbsBpAFUA3O9Q3QpM0tzBfkXfFnbcszahGmHGnfegKZsBUMZy0lwAAAAAAHorYgAAAAAAABfp////+AAAAABq14UwAAAAAGrXhS8AAAAAAHtwTAAAAAAAAArlDLhFBlKRhWel4wLtsrEajBQelDtcXYQT3qeQTGf516sXmLLMQKfC78YUDYWokxLbm2gDPMAZDQy+JWlwxPgLW6eeiSo64N3EirHjsIFT+a013YyiqPj4I+/1IZVMkRgfD0THNxxLXM/WlKA6mt3eWst1W2Y6j157wcpgK4J9ygGS+QiMMKXYZOrewbbgsOrUhDe/J4S5PCvd6onV27PPBqqlp1KJCqxCdZ7aqRFaUTjcBr1j0uXraZfwZs/PrVyVJfVNSsuApkpT+4S0imxUCX9uByyzIOKy8SzarbhF3w26W391iMnS9QNpm8eFX27AaQBVAOxdOZhGqSCfP+WIHXCq6SaMlDOf+YF+jRj/GfoF7qHIAAAAAAfOqoQAAAAAAAHtL/////gAAAAAateFMAAAAABq14UvAAAAAAfi+x8AAAAAAADvUAxwGoQhFIjN9o7R3hr0K6zNHAkIvl2EE96nkExn+derF5iyzECnwu/GFA2FqJMS25toAzzAGQ0MviVpcMT4C1unnokqOuDdxIqx47CBU/mtNd2Moqj4+CPv9SGVTJEYHw9ExzccS1zP1pSgOprd3lrLdVtmOo9ee8HKYCuCfcoBkvkIjDCl2GTq3sG24LDq1IQ3vyeEuTwr3eqJ1duzzwaqpadSiQqsQnWe2qkRWlE43Aa9Y9Ll62mX8GbPz61clSX1TUrLgKZKU/uEtIpsVAl/bgcssyDisvEs2q24Rd8Nult/dYjJ0vUDaZvHhV9uwGkAVQAvlYYrBFZwzSK+4xFMOXY6Sgi+62Y7FF0oPDHX0RAcTwAAABEDlBtfAAAAAANmBn3////4AAAAAGrXhTAAAAAAateFLwAAABEejifeAAAAAAP31hoMLU8x60mcdH8Kvy2Fa5gsCJ6ZHeXDe5dDUKGFMkti0VetEuDeOHxOpRQNhaiTEtubaAM8wBkNDL4laXDE+Atbp56JKjrg3cSKseOwgVP5rTXdjKKo+Pgj7/UhlUyRGB8PRMc3HEtcz9aUoDqa3d5ay3VbZjqPXnvBymArgn3KAZL5CIwwpdhk6t7BtuCw6tSEN78nhLk8K93qidXbs88GqqWnUokKrEJ1ntqpEVpRONwGvWPS5etpl/Bmz8+tXJUl9U1Ky4CmSlP7hLSKbFQJf24HLLMg4rLxLNqtuEXfDbpbf3WIydL1A2mbx4VfbsBpAFUAKgHersnlGleSd7NLEiOZmE0Lv1fiRYp+Qv7NKCmGeg0AAAAAAU+9OAAAAAAAAFZL////+AAAAABq14UwAAAAAGrXhS8AAAAAAVMJvwAAAAAAADJlDAUTOq6HZgfK8Px4MvkaM6hCZGhuw3uXQ1ChhTJLYtFXrRLg3jh8TqUUDYWokxLbm2gDPMAZDQy+JWlwxPgLW6eeiSo64N3EirHjsIFT+a013YyiqPj4I+/1IZVMkRgfD0THNxxLXM/WlKA6mt3eWst1W2Y6j157wcpgK4J9ygGS+QiMMKXYZOrewbbgsOrUhDe/J4S5PCvd6onV27PPBqqlp1KJCqxCdZ7aqRFaUTjcBr1j0uXraZfwZs/PrVyVJfVNSsuApkpT+4S0imxUCX9uByyzIOKy8SzarbhF3w26W391iMnS9QNpm8eFX27AaQBVAGeu1aJP2tBFR15xlcmKmK6hGcdj8nLUUj9brJOk8zwrAAAAAAH5AgAAAAAAAAA0/f////gAAAAAateFMAAAAABq14UvAAAAAAH5Qk0AAAAAAAA73QwjZR3rR2AzU/wyu1fO2JNiZmWnfioAU1tWdRBnd7AXLkcWxDxOW3Sjbg8IC1FQd39GwQAzEStpL7YPnBZ5ArnlB4CwGIngTa8UdbZE+/MXe7KZGMhuZqVwMZyha8OJR0k+nJ/AS1zP1pSgOprd3lrLdVtmOo9ee8HKYCuCfcoBkvkIjDCl2GTq3sG24LDq1IQ3vyeEuTwr3eqJ1duzzwaqpadSiQqsQnWe2qkRWlE43Aa9Y9Ll62mX8GbPz61clSX1TUrLgKZKU/uEtIpsVAl/bgcssyDisvEs2q24Rd8Nult/dYjJ0vUDaZvHhV9uwGkAVQCT2jNS+fHRBf3+SXHPqA6d13e/xdD2g+u24SlLkhN7twAAAAA5YQTKAAAAAAAPayb////4AAAAAGrXhTAAAAAAateFLwAAAAA5+5+YAAAAAAALOzEM4MiWIqE8ybuRKYXFxW8OBkosxIQqAFNbVnUQZ3ewFy5HFsQ8Tlt0o24PCAtRUHd/RsEAMxEraS+2D5wWeQK55QeAsBiJ4E2vFHW2RPvzF3uymRjIbmalcDGcoWvDiUdJPpyfwEtcz9aUoDqa3d5ay3VbZjqPXnvBymArgn3KAZL5CIwwpdhk6t7BtuCw6tSEN78nhLk8K93qidXbs88GqqWnUokKrEJ1ntqpEVpRONwGvWPS5etpl/Bmz8+tXJUl9U1Ky4CmSlP7hLSKbFQJf24HLLMg4rLxLNqtuEXfDbpbf3WIydL1A2mbx4VfbsBpAFUAisDHD/9X6a799e30S1HWLC1DNlPLss9cwGuxFa8E0iEAAAAASEqBvQAAAAAAEHtH////+AAAAABq14UwAAAAAGrXhS8AAAAASRRtwgAAAAAADA5xDN0LO0ikkzzVgux6Ug0bCQ4LT0Lv0VHX+v/EwaB4Mu9hfVFXzsnPbvBuDwgLUVB3f0bBADMRK2kvtg+cFnkCueUHgLAYieBNrxR1tkT78xd7spkYyG5mpXAxnKFrw4lHST6cn8BLXM/WlKA6mt3eWst1W2Y6j157wcpgK4J9ygGS+QiMMKXYZOrewbbgsOrUhDe/J4S5PCvd6onV27PPBqqlp1KJCqxCdZ7aqRFaUTjcBr1j0uXraZfwZs/PrVyVJfVNSsuApkpT+4S0imxUCX9uByyzIOKy8SzarbhF3w26W391iMnS9QNpm8eFX27AaQBVAPDVfeylez2i/mOkk/TCWSX9/Y7fg0sg+T4fhNvRUE1KAAAAAAAAxP0AAAAAAAAAHv////YAAAAAateFMAAAAABq14UvAAAAAAAAxmQAAAAAAAAAGwz0YW8uEZkqyzBMlYPaNBiaGz6zT9FR1/r/xMGgeDLvYX1RV87Jz27wbg8IC1FQd39GwQAzEStpL7YPnBZ5ArnlB4CwGIngTa8UdbZE+/MXe7KZGMhuZqVwMZyha8OJR0k+nJ/AS1zP1pSgOprd3lrLdVtmOo9ee8HKYCuCfcoBkvkIjDCl2GTq3sG24LDq1IQ3vyeEuTwr3eqJ1duzzwaqpadSiQqsQnWe2qkRWlE43Aa9Y9Ll62mX8GbPz61clSX1TUrLgKZKU/uEtIpsVAl/bgcssyDisvEs2q24Rd8Nult/dYjJ0vUDaZvHhV9uwGk=";

const COMPUTE_UNIT_PRICE_MICRO_LAMPORTS = 50_000;
const RECENT_BLOCKHASH = "11111111111111111111111111111111";

const payer = Keypair.generate();
const connection = new Connection("http://127.0.0.1:8899", "confirmed");
// Creating the encoded VAA account is the only instruction that reads the cluster.
jest
  .spyOn(connection, "getMinimumBalanceForRentExemption")
  .mockResolvedValue(10_000_000);
const pythSolanaReceiver = new PythSolanaReceiver({
  connection,
  wallet: new NodeWallet(payer),
});
const pusher = new SolanaPricePusher(
  pythSolanaReceiver,
  {} as HermesClient,
  {} as Logger,
  0,
  COMPUTE_UNIT_PRICE_MICRO_LAMPORTS,
  payer,
);
const pushOracleProgramId = pythSolanaReceiver.pushOracle.programId.toBase58();

const accountAt = (tx: VersionedTransaction, index: number | undefined) => {
  const key =
    index === undefined ? undefined : tx.message.staticAccountKeys[index];
  if (key === undefined) {
    throw new Error(`No account at index ${String(index)}`);
  }
  return key.toBase58();
};

const instructionPrograms = (tx: VersionedTransaction) =>
  tx.message.compiledInstructions.map((ix) => accountAt(tx, ix.programIdIndex));

// The price feed account is the 6th account of `updatePriceFeed`.
const updatedPriceFeedAccounts = (tx: VersionedTransaction) =>
  tx.message.compiledInstructions
    .filter((ix) => accountAt(tx, ix.programIdIndex) === pushOracleProgramId)
    .map((ix) => accountAt(tx, ix.accountKeyIndexes[5]));

describe("SolanaPricePusher v1 transactions", () => {
  it("packs all the price updates into self-contained v1 transactions", async () => {
    const transactions = await pusher.buildV1Transactions(
      [PRICE_UPDATE_DATA],
      RECENT_BLOCKHASH,
    );

    expect(transactions.length).toBeGreaterThan(1);
    const priceFeedAccounts: string[] = [];
    for (const { tx, signers } of transactions) {
      expect(tx.version).toBe(1);
      expect(tx.serialize().length).toBeLessThanOrEqual(4096);

      // Each transaction creates and closes its own encoded VAA account.
      expect(signers.map(({ publicKey }) => publicKey.toBase58())).toEqual([
        accountAt(tx, 1),
      ]);
      const programs = instructionPrograms(tx);
      expect(programs[0]).toBe(SystemProgram.programId.toBase58());
      expect(programs.at(-1)).toBe(
        pythSolanaReceiver.wormhole.programId.toBase58(),
      );
      expect(
        tx.message.compiledInstructions
          .at(-1)
          ?.accountKeyIndexes.map((index) => accountAt(tx, index)),
      ).toContain(accountAt(tx, 1));

      const computeUnitLimit =
        tx.message.transactionConfig?.computeUnitLimit ?? 0;
      expect(computeUnitLimit).toBeGreaterThan(0);
      expect(tx.message.transactionConfig?.priorityFeeLamports).toBe(
        BigInt(
          Math.ceil(
            (COMPUTE_UNIT_PRICE_MICRO_LAMPORTS * computeUnitLimit) / 1e6,
          ),
        ),
      );

      priceFeedAccounts.push(...updatedPriceFeedAccounts(tx));
    }

    expect(priceFeedAccounts.sort()).toEqual(
      PRICE_FEED_IDS.map((id) =>
        pythSolanaReceiver.getPriceFeedAccountAddress(0, id).toBase58(),
      ).sort(),
    );
  });

  it("puts the maximum number of price updates in each transaction", async () => {
    const transactions = await pusher.buildV1Transactions(
      [PRICE_UPDATE_DATA],
      RECENT_BLOCKHASH,
    );

    let start = 0;
    for (const { tx } of transactions.slice(0, -1)) {
      const numUpdates = updatedPriceFeedAccounts(tx).length;
      // One more price update does not fit.
      const { postInstructions, closeInstructions } =
        await pythSolanaReceiver.buildUpdatePriceFeedInstructions(
          [
            sliceAccumulatorUpdateData(
              Buffer.from(PRICE_UPDATE_DATA, "base64"),
              start,
              start + numUpdates + 1,
            ).toString("base64"),
          ],
          0,
        );
      expect(
        pusher.compileV1Transaction(
          [...postInstructions, ...closeInstructions],
          RECENT_BLOCKHASH,
        ),
      ).toBeUndefined();
      start += numUpdates;
    }
  });

  it("signs with the payer and the encoded VAA account", async () => {
    const [transaction] = await pusher.buildV1Transactions(
      [PRICE_UPDATE_DATA],
      RECENT_BLOCKHASH,
    );
    if (transaction === undefined) {
      throw new Error("No transaction");
    }
    const tx = await pusher.signV1Transaction(transaction);

    expect(accountAt(tx, 0)).toBe(payer.publicKey.toBase58());
    expect(tx.signatures).toHaveLength(2);
    for (const signature of tx.signatures) {
      expect(signature.some((byte) => byte !== 0)).toBe(true);
    }
  });
});
