// break the source material into small chunks
const generateChunks = (input: string): string[] => {
  return (
    input
      .trim()
      .split(".")
      .filter((i) => i !== "")
      // me applyig my big brain lol
      .map((i) => i.trim())
  );
};
