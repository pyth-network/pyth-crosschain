const PUBLISHERS: string[] = [
  "PinYvHqMTZVrRTpwK9x3dB9vL7tsGtGedSz8EqeynuA",
  "HfeFy4G9r77iyeXdbfNJjYw4z3NPEKDL6YQh3JzJ9s9f",
  "5YXnWX6Mmd8hp7fCpAB3wQUrHt6WtjJrA5QjmBuySsDP",
  "5XLqnSjJBAm1XjAcR76QCn8eB1phEQ3py2VAE2f8pdCQ",
  "Cy7J9Y6GZB3Jhj6xFnSAPs3VNPZhWoFVmYaA6hERr4vC",
  "9TvAYCUkGajRXs42ZrTpDQ3xf16cXBG13AJ3WRAue6Vw",
  "2V7t5NaKY7aGkwytCWQgvUYZfEr9XMwNChhJEakTExk6",
  "pyq7ySiH5RvKteu2vdXKC7SNyNDp9vNDkGXdHxSpPtu",
  "9Shm3gXvtFpm68iUzmNtMvWBsZw62TJhVQykSqgwbpkz",
  "GKNcUmNacSJo4S2Kq3DuYRYRGw3sNUfJ4tyqd198t6vQ",
  "AyppMMH42nZVQrcxTP2zk9Psmy9quS6oF1yF4xVtjyL5",
  "F42dQ3SMssashRsA4SRfwJxFkGKV1bE3TcmpkagX8vvX",
  "5ZLaVaVJdvdqGmvnS4jYgJ7k54Kdev7f1q5LDytjwqJ6",
  "EmhK376f6fugThujtZPe2ekffZ2uBoBS3QLRCHfVN484",
  "2WGtdTDLp6PBC5rYo8nKYBUsUJpS4v71gtKhmr8o9KRh",
  "AGaSHpDpyveuLyiaocNXMMFCf1LCBBynyaKMJkL8AKK4",
  "2tYkXx6RgK2DNTZ64LCzwpMqg4Li6VnLf2pP395z6x44",
  "JTmFx5zX9mM94itfk2nQcJnQQDPjcv4UPD7SYj6xDCV",
  "HXnWFNs2oSfcYUojy1tAW4P3EQTamPTNSduEhPhWCCXN",
  "D68ZFycNR6H4A79puYfZpE1j8LZQeP9SXTukF3dSUby4",
  "5kK8zTxAEHqiwjS6heQt125NHqMed3sQUL3Q56C9QYmG",
  "9N3GhV8oR8rVNB4zBSFwKk8vKtyxaCD8XBKsSPSDGtkC",
  "Y2akr3bXHRsqyP1QJtbm9G9N88ZV4t1KfaFeDzKRTfr",
  "9aiGb2qTGB7xxrEWRrHtzgzBYTfq4y51hQGHrYxxJWna",
  "2ehFijXkacypZL4jdfPm38BJnMKsN2nMHm8xekbujjdx",
];

for (let pub of PUBLISHERS) {
  console.log(`
    CAST(
        MAX(
          array_contains(
            publishers,
            "${pub}"
          )
        ) over (
          order by
            block_slot range between 25 preceding
            and current row
        ) AS INT
      ) +`);
}
