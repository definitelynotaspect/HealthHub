let medicineTransactionSchemaReady = false
let medicineTransactionSchemaPromise = null

async function runMedicineTransactionSchemaCheck(connection) {
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS medicine_transactions (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      medicine_id INT UNSIGNED NULL,
      medicine_name VARCHAR(191) NOT NULL,
      action VARCHAR(40) NOT NULL,
      quantity INT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY medicine_transactions_medicine_index (medicine_id),
      KEY medicine_transactions_created_index (created_at),
      CONSTRAINT medicine_transactions_medicine_fk
        FOREIGN KEY (medicine_id)
        REFERENCES medicines (id)
        ON DELETE SET NULL
    )
  `)
}

export async function ensureMedicineTransactionSchema(connection) {
  if (medicineTransactionSchemaReady) return
  if (medicineTransactionSchemaPromise) return medicineTransactionSchemaPromise

  medicineTransactionSchemaPromise = runMedicineTransactionSchemaCheck(connection)
    .then(() => {
      medicineTransactionSchemaReady = true
    })
    .finally(() => {
      medicineTransactionSchemaPromise = null
    })

  return medicineTransactionSchemaPromise
}

export async function recordMedicineTransaction(connection, medicine, quantity) {
  if (!quantity) return

  await connection.execute(
    `INSERT INTO medicine_transactions
      (medicine_id, medicine_name, action, quantity)
     VALUES (?, ?, ?, ?)`,
    [
      medicine.id,
      medicine.name,
      quantity > 0 ? 'Added' : 'Dispensed',
      quantity,
    ]
  )
}
