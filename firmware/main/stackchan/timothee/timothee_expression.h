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

// Returns false for unknown or untrusted input. No allocation is performed.
bool parseSemanticState(std::string_view value, SemanticState& state);

std::string_view semanticStateName(SemanticState state);

// Returns the bounded default profile currently defined by the Timothee MOD.
Expression expressionFor(SemanticState state);

}  // namespace timothee
