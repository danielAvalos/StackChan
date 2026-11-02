/*
 * SPDX-FileCopyrightText: 2026 OpenAI contributors
 *
 * SPDX-License-Identifier: MIT
 */
#pragma once

#include <cstdint>
#include <string_view>

#include "../avatar/avatar/elements/emotion.h"

namespace timothee {

// Stable, provider-independent vocabulary shared with the Timothee MOD.
// Network messages must be reduced to one of these values before reaching
// device rendering code.
enum class SemanticState : uint8_t {
    Neutral = 0,
    Listening,
    Thinking,
    Speaking,
    Acknowledgement,
    Warning,
    Sleeping,
};

struct Expression {
    SemanticState state;
    stackchan::avatar::Emotion emotion;
    uint8_t red;
    uint8_t green;
    uint8_t blue;
    uint8_t brightness_percent;
    uint32_t duration_ms;
};

struct LedColor {
    uint8_t red;
    uint8_t green;
    uint8_t blue;
};

enum class BridgeStatus : uint8_t {
    Disabled = 0,
    Applied,
    InvalidState,
    AvatarUnavailable,
    DurationRequired,
    DurationOutOfRange,
};

struct BridgePolicy {
    // Factory firmware remains unchanged unless an owner explicitly enables
    // this adapter at its future integration point.
    bool enabled = false;
    uint32_t max_duration_ms = 6000;
};

// Returns false for unknown or untrusted input. No allocation is performed.
bool parseSemanticState(std::string_view value, SemanticState& state);

std::string_view semanticStateName(SemanticState state);

// Returns the bounded default profile currently defined by the Timothee MOD.
Expression expressionFor(SemanticState state);

// Pure brightness scaling shared by host tests and the owner-loop bridge.
LedColor ledColorFor(const Expression& expression);

// Pure fail-closed gate used by the device bridge. Keeping this decision
// independent of StackChan makes it host-testable without the ESP-IDF tree.
BridgeStatus validateBridgeRequest(const BridgePolicy& policy, std::string_view semantic_state,
                                   uint32_t duration_ms, bool avatar_available);

}  // namespace timothee
