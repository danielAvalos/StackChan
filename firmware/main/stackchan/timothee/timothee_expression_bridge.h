/*
 * SPDX-FileCopyrightText: 2026 OpenAI contributors
 *
 * SPDX-License-Identifier: MIT
 */
#pragma once

#include "../stackchan.h"
#include "timothee_expression.h"

#include <cstdint>
#include <string_view>

namespace timothee {

/**
 * Small, provider-free factory adapter. It accepts only the closed semantic
 * vocabulary and queues the existing timed emotion modifier, which restores
 * the avatar's previous emotion when the transient expression ends.
 *
 * It intentionally has no network, JSON, filesystem, credential, OTA or
 * Mission/Genesis dependency. The app does not instantiate it by default.
 * `apply` must run on the StackChan owner/main loop because the avatar and
 * modifier list are mutable firmware state; callers may run the pure
 * `validateBridgeRequest` gate concurrently before dispatching to that loop.
 */
class ExpressionBridge {
public:
    explicit ExpressionBridge(BridgePolicy policy = {}) : _policy(policy)
    {
    }

    BridgeStatus apply(stackchan::StackChan& stackchan, std::string_view semantic_state,
                       uint32_t duration_ms = 0) const;

    bool enabled() const
    {
        return _policy.enabled;
    }

    uint32_t maxDurationMs() const
    {
        return _policy.max_duration_ms;
    }

private:
    BridgePolicy _policy;
};

}  // namespace timothee
