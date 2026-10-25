import { Navigate, Route, Routes } from "react-router";
import { LoginPage } from "./features/auth/LoginPage";
import { RoomSeatsPage } from "./features/m1/RoomSeatsPage";
import { RoomsPage } from "./features/m1/RoomsPage";
import { BookingsPage } from "./features/m2/BookingsPage";
import { TicketsPage } from "./features/m3/TicketsPage";
import { AppShell } from "./features/shell/AppShell";

/** Route table. Everything under AppShell requires a session. */
export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<AppShell />}>
        <Route index element={<Navigate to="/m1/rooms" replace />} />
        <Route path="/m1/rooms" element={<RoomsPage />} />
        <Route path="/m1/rooms/:id" element={<RoomSeatsPage />} />
        <Route path="/m2" element={<BookingsPage />} />
        <Route path="/m3" element={<TicketsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
