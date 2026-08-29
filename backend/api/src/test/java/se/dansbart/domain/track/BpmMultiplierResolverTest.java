package se.dansbart.domain.track;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

/**
 * Boundary cases mirror neckenml-analyzer's StyleClassifier._calculate_mpm
 * (style_classifier.py) exactly — this class is a direct port, not a reinterpretation.
 */
class BpmMultiplierResolverTest {

    @Test
    void nullOrZeroRawBpmYieldsNoOp() {
        assertResult(BpmMultiplierResolver.resolve("Hambo", null), 1.0f, 0);
        assertResult(BpmMultiplierResolver.resolve("Hambo", 0f), 1.0f, 0);
    }

    @Test
    void hamboBoundary() {
        assertResult(BpmMultiplierResolver.resolve("Hambo", 160f), 1.0f, 160);
        assertResult(BpmMultiplierResolver.resolve("Hambo", 161f), 0.333f, 53);
        assertResult(BpmMultiplierResolver.resolve("Hambo", 70f), 1.0f, 70);
        assertResult(BpmMultiplierResolver.resolve("Hambo", 69f), 2.0f, 138);
    }

    @Test
    void polskaBoundary() {
        assertResult(BpmMultiplierResolver.resolve("Polska", 180f), 1.0f, 180);
        assertResult(BpmMultiplierResolver.resolve("Polska", 181f), 0.5f, 90);
        assertResult(BpmMultiplierResolver.resolve("Slängpolska", 181f), 0.5f, 90);
    }

    @Test
    void schottisBoundary() {
        assertResult(BpmMultiplierResolver.resolve("Schottis", 200f), 1.0f, 200);
        assertResult(BpmMultiplierResolver.resolve("Schottis", 201f), 0.5f, 100);
        assertResult(BpmMultiplierResolver.resolve("Schottis", 75f), 1.0f, 75);
        assertResult(BpmMultiplierResolver.resolve("Schottis", 74f), 2.0f, 148);
    }

    @Test
    void valsBoundary() {
        assertResult(BpmMultiplierResolver.resolve("Vals", 100f), 1.0f, 100);
        assertResult(BpmMultiplierResolver.resolve("Vals", 101f), 0.333f, 33);
    }

    @Test
    void unknownStyleAlwaysPassesThrough() {
        assertResult(BpmMultiplierResolver.resolve("Gånglåt", 120f), 1.0f, 120);
    }

    private void assertResult(BpmMultiplierResolver.Result actual, float expectedMultiplier, int expectedEffectiveBpm) {
        assertEquals(expectedMultiplier, actual.multiplier(), 0.0001f);
        assertEquals(expectedEffectiveBpm, actual.effectiveBpm());
    }
}
