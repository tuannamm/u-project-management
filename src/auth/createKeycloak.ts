import Keycloak from 'keycloak-js';
import { config } from '../config';
import type { KeycloakClient } from './AuthProvider';

// Tách khỏi AuthProvider để test chỉ cần truyền một Keycloak giả (keycloak-js là gói ESM, Jest của CRA không nạp được).
export function createKeycloak(): KeycloakClient {
  return new Keycloak({ url: config.keycloakUrl, realm: config.realm, clientId: config.clientId });
}
