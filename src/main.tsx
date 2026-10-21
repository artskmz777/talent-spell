import React from "react";
import ReactDOM from "react-dom/client";
import "./styles.css";
import { Route } from "./routes/index";

const Component = Route.options.component!;

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Component />
  </React.StrictMode>
);
