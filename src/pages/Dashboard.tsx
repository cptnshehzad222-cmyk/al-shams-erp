function Dashboard() {
  return (
    <div className="dashboard-page">

      <h1 className="welcome-title">
        WELCOME TO AL SHAMS ERP
      </h1>


      <div className="cards">

        <div className="card sales-card">
          <h3>TOTAL SALES QTY</h3>
          <p>0</p>
        </div>


        <div className="card purchase-card">
          <h3>TOTAL SALES AMOUNT</h3>
          <p>0 SAR</p>
        </div>


        <div className="card stock-card">
          <h3>TOTAL PURCHASE QTY</h3>
          <p>0</p>
        </div>


        <div className="card customer-card">
          <h3>TOTAL PURCHASE AMOUNT</h3>
          <p>0 SAR</p>
        </div>


      </div>

    </div>
  );
}

export default Dashboard;