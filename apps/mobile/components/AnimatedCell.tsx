import { useEffect, useRef } from "react";
import { Animated, Text, StyleSheet } from "react-native";
import type { LetterResult } from "@crux/shared";
import { COLORS } from "../lib/theme";

const RESULT_COLORS: Record<LetterResult, string> = {
  correct: COLORS.correct,
  present: COLORS.present,
  absent: COLORS.absent,
};

interface Props {
  letter: string;
  result?: LetterResult;
  revealed: boolean;
  delay: number;
  bounce?: boolean;
  bounceDelay?: number;
  instant?: boolean;
}

export default function AnimatedCell({ letter, result, revealed, delay, bounce, bounceDelay = 0, instant }: Props) {
  const flipAnim = useRef(new Animated.Value(instant && revealed ? 1 : 0)).current;
  const bounceAnim = useRef(new Animated.Value(0)).current;
  const hasRevealed = useRef(instant && revealed);

  useEffect(() => {
    if (revealed && !hasRevealed.current && result) {
      hasRevealed.current = true;
      Animated.timing(flipAnim, {
        toValue: 1,
        duration: 400,
        delay,
        useNativeDriver: true,
      }).start();
    }
  }, [revealed, result]);

  useEffect(() => {
    if (bounce) {
      Animated.sequence([
        Animated.delay(bounceDelay),
        Animated.timing(bounceAnim, { toValue: -14, duration: 150, useNativeDriver: true }),
        Animated.timing(bounceAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
      ]).start();
    }
  }, [bounce]);

  const rotateX = flipAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ["0deg", "90deg", "0deg"],
  });

  const bgColor = flipAnim.interpolate({
    inputRange: [0, 0.49, 0.51, 1],
    outputRange: [
      letter ? "#878a8c" : "transparent",
      letter ? "#878a8c" : "transparent",
      result ? RESULT_COLORS[result] : "transparent",
      result ? RESULT_COLORS[result] : "transparent",
    ],
  });

  const borderColor = result
    ? flipAnim.interpolate({
        inputRange: [0, 0.5, 1],
        outputRange: ["#565758", "#565758", result ? RESULT_COLORS[result] : "#3a3a3c"],
      })
    : letter ? "#565758" : "#3a3a3c";

  return (
    <Animated.View
      style={[
        styles.cell,
        {
          backgroundColor: bgColor,
          borderColor: borderColor as any,
          transform: [{ perspective: 300 }, { rotateX }, { translateY: bounceAnim }],
        },
      ]}
    >
      <Text style={[styles.text, { color: letter ? "#fff" : "#555" }]}>{letter}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  cell: {
    width: 52,
    height: 52,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 4,
  },
  text: {
    fontSize: 24,
    fontWeight: "700",
  },
});
