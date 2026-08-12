/* Components */
export { ClientCard } from './components/ClientCard/ClientCard';
export { ClientForm } from './components/ClientForm/ClientForm';
export { ClientListFilters } from './components/ClientListFilters/ClientListFilters';
export { ClientsBoard } from './components/ClientsBoard/ClientsBoard';
export { ClientsDrawer } from './components/ClientsDrawer/ClientsDrawer';
export { ClientProjects } from './components/ClientProjects/ClientProjects';
export { NewClientForm } from './components/NewClientForm/NewClientForm';

/* Hooks */
export { useClient, useClientFilters, useClients, useCreateClient, useUpdateClient } from './hooks';

/* Services */
export { createClient, getClientById, getClients, updateClient } from './services/clientsApi';

/* Types */
export type {
  Client,
  ClientFilters,
  CreateClientPayload,
  UpdateClientPayload,
} from './types/client.types';
