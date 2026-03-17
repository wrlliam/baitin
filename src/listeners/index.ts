export type ListnerNames = "";

export type Listner = {
  name: ListnerNames;
  run: (guildId: string) => void;
};

export default {} as Record<ListnerNames, Listner>;
