export interface IKey {
    address: string;
    spendKey: string;
    viewKey: string;
}

export interface IUserRecord {
    recordID: number;
    userID: number;
    username: string;
    passwordHash: string;
    salt: string;
    address: string;
    twoFactor: boolean;
    totpSecret: string | null;
    userHash: string;
    createdAt: string;
}
