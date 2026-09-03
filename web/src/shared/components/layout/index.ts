// S-060: Navbar, NavItem, NavSubItem y PageLayout se dieron de baja — reemplazados por
// ShellSidebar/SidebarNav (S-058) y ViewHeader del DS. El barrel queda sin exports vivos;
// se conserva el archivo porque `ui/index.test.ts` sigue verificando, por nombre, que
// ninguno de los cuatro reaparezca acá.
export {};
