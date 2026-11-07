package com.motoxplus.api.search;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class SearchQueryTest {
    @Test
    void trimsAndCollapsesWhitespace() {
        assertThat(SearchQuery.clean("  brake \t\n  pad  ")).isEqualTo("brake pad");
        assertThat(SearchQuery.clean("brake pad")).isEqualTo("brake pad");
    }

    @Test
    void emptyForNullBlankOrInvisibleInput() {
        assertThat(SearchQuery.clean(null)).isEmpty();
        assertThat(SearchQuery.clean("   ")).isEmpty();
        assertThat(SearchQuery.clean("​‎\u0000")).isEmpty();
    }

    @Test
    void stripsControlAndBidiCharactersButKeepsPunctuationAndScripts() {
        assertThat(SearchQuery.clean("brake\u0000‮pad")).isEqualTo("brakepad");
        assertThat(SearchQuery.clean("25/40 oil-seal #2")).isEqualTo("25/40 oil-seal #2");
        assertThat(SearchQuery.clean("ब्रेक पैड")).isEqualTo("ब्रेक पैड");
    }

    @Test
    void capsAtOneHundredCharactersWithoutSplittingSurrogatePairs() {
        assertThat(SearchQuery.clean("x".repeat(5000))).hasSize(100);
        String emoji = "🏍".repeat(80); // 2 chars each
        String cleaned = SearchQuery.clean(emoji);
        assertThat(cleaned.length()).isLessThanOrEqualTo(100);
        assertThat(Character.isHighSurrogate(cleaned.charAt(cleaned.length() - 1))).isFalse();
    }

    @Test
    void splitsIntoLowerCaseUniqueWordsAndTrimsPlurals() {
        assertThat(SearchQuery.words("Brake Pads brake GLASS bus")).containsExactly("brake", "pad", "glass", "bus");
        assertThat(SearchQuery.words("a b c d e f g h i j")).hasSize(SearchQuery.MAX_WORDS);
        assertThat(SearchQuery.words("")).isEmpty();
    }

    @Test
    void escapesLikeWildcards() {
        assertThat(SearchQuery.escapeLike("50%_off\\")).isEqualTo("50\\%\\_off\\\\");
    }
}
