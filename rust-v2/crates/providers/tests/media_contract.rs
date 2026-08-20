use qianfu_providers::{MAX_MEDIA_BYTES, ProviderError, validate_media};

#[test]
fn media_validation_requires_matching_magic_bytes() {
    assert!(
        validate_media(
            "image/png",
            "announcements/a.png",
            &[0x89, b'P', b'N', b'G', 0x0d, 0x0a, 0x1a, 0x0a]
        )
        .is_ok()
    );
    assert!(matches!(
        validate_media("image/png", "announcements/a.png", b"<svg></svg>"),
        Err(ProviderError::InvalidMedia)
    ));
}

#[test]
fn media_validation_rejects_unsafe_keys_and_oversized_payloads() {
    assert!(matches!(
        validate_media("image/jpeg", "../escape.jpg", &[0xff, 0xd8, 0xff]),
        Err(ProviderError::InvalidObjectKey)
    ));
    assert!(matches!(
        validate_media(
            "image/jpeg",
            "images/a.jpg",
            &vec![0u8; MAX_MEDIA_BYTES + 1]
        ),
        Err(ProviderError::InvalidMedia)
    ));
}
