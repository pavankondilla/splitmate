export type SplitType = "EQUAL" | "PERCENTAGE" | "EXACT" | "SHARES";
export type ExpenseCategory = "RENT" | "GROCERIES" | "UTILITIES" | "WIFI" | "OTHER";
export type RoomRole = "admin" | "member";
export type ActivityAction =
  | "ROOM_CREATED"
  | "MEMBER_JOINED"
  | "MEMBER_LEFT"
  | "EXPENSE_ADDED"
  | "EXPENSE_DELETED"
  | "SETTLEMENT_MADE";

export interface Balance {
  userId: string;
  userName: string;
  userAvatar: string | null;
  netBalance: number;        // paise — positive = owed to you, negative = you owe
  totalOwedToUser: number;
  totalUserOwes: number;
}

export interface PairwiseBalance {
  fromUserId: string;
  fromUserName: string;
  toUserId: string;
  toUserName: string;
  amount: number;            // paise — fromUser owes toUser this amount
}
