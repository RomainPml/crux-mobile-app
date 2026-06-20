import { Text, StyleSheet } from "react-native";
import { useEffect, useState } from "react";

interface Props {
  startTime: number;
  stopped?: boolean;
}

export default function Timer({ startTime, stopped }: Props) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (stopped) return;
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime, stopped]);

  const min = Math.floor(elapsed / 60);
  const sec = elapsed % 60;

  return (
    <Text style={styles.timer}>
      {min}:{String(sec).padStart(2, "0")}
    </Text>
  );
}

const styles = StyleSheet.create({
  timer: {
    fontSize: 20,
    fontWeight: "300",
    color: "#666",
    fontVariant: ["tabular-nums"],
  },
});
