export declare function Temporalize({ model, modelHistory, sequelize, temporalOptions }: {
    model: any;
    modelHistory?: any;
    sequelize: any;
    temporalOptions: any;
}): any;
export declare function getTransactionId(transaction: any): any;
export declare function addEventIdToTransaction(eventId: string, transaction: any): void;
