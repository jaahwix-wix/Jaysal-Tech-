import { initializeApp } from 'firebase/app';
import {
  EmailAuthProvider,
  getAuth,
  GoogleAuthProvider,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDocFromServer,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleAuthProvider = new GoogleAuthProvider();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function testConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Firestore connection failed: client is offline. Verify firebase-applet-config.json.');
    }
    return false;
  }
}

export async function safeSetDoc<T extends Record<string, unknown>>(
  collectionName: string,
  id: string,
  data: T
): Promise<void> {
  const path = `${collectionName}/${id}`;
  try {
    await setDoc(doc(db, collectionName, id), data);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function safeUpdateDoc(
  collectionName: string,
  id: string,
  data: Record<string, unknown>
): Promise<void> {
  const path = `${collectionName}/${id}`;
  try {
    await updateDoc(doc(db, collectionName, id), data);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function safeDeleteDoc(collectionName: string, id: string): Promise<void> {
  const path = `${collectionName}/${id}`;
  try {
    await deleteDoc(doc(db, collectionName, id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function reauthenticateCurrentUserWithPassword(password: string): Promise<void> {
  const user = auth.currentUser;
  if (!user || !user.email) {
    throw new Error('No authenticated email session is active.');
  }
  const credential = EmailAuthProvider.credential(user.email, password);
  await reauthenticateWithCredential(user, credential);
}

export async function reauthenticateCurrentUserWithGoogle(): Promise<void> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('No authenticated user session is active.');
  }
  await reauthenticateWithPopup(user, googleAuthProvider);
}

const FIRESTORE_BATCH_CHUNK = 400;

export async function safeBatchUpdate(
  collectionName: string,
  updates: { id: string; data: Record<string, unknown> }[]
): Promise<void> {
  if (updates.length === 0) return;
  try {
    for (let i = 0; i < updates.length; i += FIRESTORE_BATCH_CHUNK) {
      const slice = updates.slice(i, i + FIRESTORE_BATCH_CHUNK);
      const batch = writeBatch(db);
      for (const item of slice) {
        batch.update(doc(db, collectionName, item.id), item.data);
      }
      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${collectionName}/bulk_update`);
  }
}

export async function safeBatchDelete(collectionName: string, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  try {
    for (let i = 0; i < ids.length; i += FIRESTORE_BATCH_CHUNK) {
      const slice = ids.slice(i, i + FIRESTORE_BATCH_CHUNK);
      const batch = writeBatch(db);
      for (const id of slice) {
        batch.delete(doc(db, collectionName, id));
      }
      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${collectionName}/bulk_delete`);
  }
}

