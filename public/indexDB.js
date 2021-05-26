let db;
let budgetVersion;

// Create a new db request for a "budget" database.
const request = indexedDB.open("BudgetDB", budgetVersion || 1);

request.onupgradeneeded = function (e) {
  console.log("Upgrade needed in IndexDB");

  const { oldVersion } = e;
  const newVersion = e.newVersion || db.version;

  console.log(`DB Updated from version ${oldVersion} to ${newVersion}`);

  db = e.target.result;

  if (db.objectStoreNames.length === 0) {
    db.createObjectStore("BudgetStore", { autoIncrement: true });
  }
};

request.onerror = function (e) {
  console.log(`Woops! ${e.target.errorCode}`);
};

function checkDatabase() {
  console.log("check db invoked");

  // Open a transaction on your BudgetStore db
  let transaction = db.transaction(["BudgetStore"], "readwrite");

  // access your BudgetStore object
  const store = transaction.objectStore("BudgetStore");

  // Get all records from store and set to a variable
  const getAll = store.getAll();

  // If the request was successful
  getAll.onsuccess = function () {
    // If there are items in the store, we need to bulk add them when we are back online
    if (getAll.result.length > 0) {
      fetch("/api/transaction/bulk", {
        method: "POST",
        body: JSON.stringify(getAll.result),
        headers: {
          Accept: "application/json, text/plain, */*",
          "Content-Type": "application/json",
        },
      })
        .then((response) => response.json())
        .then((res) => {
          // If our returned response is not empty
          if (res.length !== 0) {
            refreshIndexDB();
            // Open another transaction to BudgetStore with the ability to read and write
            transaction = db.transaction(["BudgetStore"], "readwrite");

            // Assign the current store to a variable
            const currentStore = transaction.objectStore("BudgetStore");

            // Clear existing entries because our bulk add was successful
            currentStore.clear();
            
          }
        });
    }
  };
}

request.onsuccess = function (e) {
  console.log("success");
  db = e.target.result;

  // Check if app is online before reading from db
  if (navigator.onLine) {
    console.log("Backend online! 🗄️");
    checkDatabase();
  }
};

const saveRecord = (record) => {
  console.log("Save record invoked");
  // Create a transaction on the BudgetStore db with readwrite access
  const transaction = db.transaction(["BudgetStore"], "readwrite");

  // Access your BudgetStore object store
  const store = transaction.objectStore("BudgetStore");

  // Add record to your store with add method.
  store.add(record);
};

// clears IndexDB & reloads with current data from serverside DB
const refreshIndexDB = () => {
  // quick timeout to ensure function isn't called too early
  new Promise((resolve) => {
    setTimeout(resolve, 500);
  });
  

  fetch("/api/transaction")
    .then((response) => {
      console.log('Retrieving updated databse');
      return response.json();
    })
    .then((data) => {
      const transaction = db.transaction(["BudgetStore"], "readwrite");
      const store = transaction.objectStore("BudgetStore");
      console.log('Clearing store 🧹');
      store.clear();
      data.forEach((element) => {
        const transaction2 = db.transaction(["BudgetStore"], "readwrite");
        const store2 = transaction2.objectStore("BudgetStore");
        console.log('Created updated database inside indexDB');
        store2.add(element);
      });
    });
};

// Listen for app coming back online
window.addEventListener("online", checkDatabase);