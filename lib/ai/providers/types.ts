export type ToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};
