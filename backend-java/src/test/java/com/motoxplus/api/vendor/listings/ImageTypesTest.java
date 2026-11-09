package com.motoxplus.api.vendor.listings;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;

class ImageTypesTest {
    static final byte[] JPEG = {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, (byte) 0xE0, 0, 0x10};
    static final byte[] PNG = {(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 0x0D};
    static final byte[] WEBP = {'R', 'I', 'F', 'F', 0x24, 0, 0, 0, 'W', 'E', 'B', 'P', 'V', 'P', '8', ' '};

    @Test
    void acceptsJpegPngAndWebpByTheirBytes() {
        assertThat(ImageTypes.sniff(JPEG)).isEqualTo("image/jpeg");
        assertThat(ImageTypes.sniff(PNG)).isEqualTo("image/png");
        assertThat(ImageTypes.sniff(WEBP)).isEqualTo("image/webp");
    }

    @Test
    void rejectsEverythingElseWhateverItClaimsToBe() {
        assertThat(ImageTypes.sniff("GIF89a......".getBytes(StandardCharsets.US_ASCII))).isNull();
        assertThat(ImageTypes.sniff("%PDF-1.7".getBytes(StandardCharsets.US_ASCII))).isNull();
        assertThat(ImageTypes.sniff("<svg xmlns=\"http://www.w3.org/2000/svg\"/>".getBytes(StandardCharsets.US_ASCII))).isNull();
        assertThat(ImageTypes.sniff("<html><script>".getBytes(StandardCharsets.US_ASCII))).isNull();
        // RIFF container that is not WEBP (a WAV file).
        assertThat(ImageTypes.sniff(new byte[] {'R', 'I', 'F', 'F', 0, 0, 0, 0, 'W', 'A', 'V', 'E'})).isNull();
        assertThat(ImageTypes.sniff(new byte[] {(byte) 0xFF, (byte) 0xD8})).isNull();
        assertThat(ImageTypes.sniff(new byte[0])).isNull();
    }

    @Test
    void fileNamesLoseTheirPathAndControlCharacters() {
        assertThat(ImageTypes.safeFileName("C:\\Users\\me\\pad\u0007.jpg", "jpg")).isEqualTo("pad.jpg");
        assertThat(ImageTypes.safeFileName("../../etc/passwd", "png")).isEqualTo("passwd");
        assertThat(ImageTypes.safeFileName("  ", "webp")).isEqualTo("photo.webp");
    }
}
