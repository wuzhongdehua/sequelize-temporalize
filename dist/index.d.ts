export declare function Temporalize({ model, modelHistory, sequelize, temporalizeOptions }: {
    model: any;
    modelHistory?: any;
    sequelize: any;
    temporalizeOptions: any;
}): any;
export declare function getTransactionId(transaction: any): any;
export declare function addEventIdToTransaction(eventId: string, transaction: any): void;
