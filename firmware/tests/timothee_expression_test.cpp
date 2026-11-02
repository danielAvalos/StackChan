#include "stackchan/timothee/timothee_expression.h"

#include <atomic>
#include <cassert>
#include <string_view>
#include <thread>
#include <vector>

int main()
{
    using timothee::SemanticState;

    SemanticState state = SemanticState::Neutral;
    assert(timothee::parseSemanticState("thinking", state));
    assert(state == SemanticState::Thinking);
    assert(timothee::semanticStateName(state) == std::string_view("thinking"));

    assert(!timothee::parseSemanticState("execute_genesis", state));
    assert(state == SemanticState::Thinking);

    const auto expression = timothee::expressionFor(SemanticState::Acknowledgement);
    assert(expression.emotion == stackchan::avatar::Emotion::Happy);
    assert(expression.red == 30);
    assert(expression.green == 210);
    assert(expression.blue == 100);
    assert(expression.brightness_percent == 40);
    assert(expression.duration_ms == 500);
    const auto color = timothee::ledColorFor(expression);
    assert(color.red == 12);
    assert(color.green == 84);
    assert(color.blue == 40);

    const timothee::BridgePolicy default_policy;
    assert(timothee::validateBridgeRequest(default_policy, "thinking", 500, true)
           == timothee::BridgeStatus::Disabled);

    const timothee::BridgePolicy enabled_policy{ true, 6000 };
    assert(timothee::validateBridgeRequest(enabled_policy, "execute_genesis", 500, true)
           == timothee::BridgeStatus::InvalidState);
    assert(timothee::validateBridgeRequest(enabled_policy, "thinking", 500, false)
           == timothee::BridgeStatus::AvatarUnavailable);

    const timothee::BridgePolicy invalid_policy{ true, 0 };
    assert(timothee::validateBridgeRequest(invalid_policy, "thinking", 500, true)
           == timothee::BridgeStatus::DurationOutOfRange);

    // The pure policy gate is reentrant. Mutable avatar/modifier state is
    // intentionally excluded and must be dispatched by the owner/main loop.
    std::atomic<bool> concurrent_failure{ false };
    std::vector<std::thread> workers;
    workers.reserve(8);
    for (int worker = 0; worker < 8; ++worker) {
        workers.emplace_back([&]() {
            for (int iteration = 0; iteration < 10000; ++iteration) {
                SemanticState local_state = SemanticState::Neutral;
                if (!timothee::parseSemanticState("speaking", local_state)
                    || local_state != SemanticState::Speaking
                    || timothee::validateBridgeRequest(enabled_policy, "speaking", 250, true)
                        != timothee::BridgeStatus::Applied
                    || timothee::validateBridgeRequest(enabled_policy, "execute_genesis", 250, true)
                        != timothee::BridgeStatus::InvalidState) {
                    concurrent_failure.store(true, std::memory_order_relaxed);
                    return;
                }
            }
        });
    }
    for (auto& worker_thread : workers) {
        worker_thread.join();
    }
    assert(!concurrent_failure.load(std::memory_order_relaxed));

    return 0;
}
