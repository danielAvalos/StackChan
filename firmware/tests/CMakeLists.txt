cmake_minimum_required(VERSION 3.16)

project(stackchan_firmware_tests LANGUAGES CXX)

enable_testing()

add_executable(motion_math_test
    motion_math_test.cpp
    ../main/stackchan/motion/motion_math.cpp
)

target_include_directories(motion_math_test PRIVATE
    ../main
)

target_compile_features(motion_math_test PRIVATE cxx_std_17)

add_test(NAME motion_math_test COMMAND $<TARGET_FILE:motion_math_test>)

add_executable(timothee_expression_test
    timothee_expression_test.cpp
    ../main/stackchan/timothee/timothee_expression.cpp
)

target_include_directories(timothee_expression_test PRIVATE
    ../main
)

target_compile_features(timothee_expression_test PRIVATE cxx_std_17)

add_test(NAME timothee_expression_test COMMAND $<TARGET_FILE:timothee_expression_test>)
