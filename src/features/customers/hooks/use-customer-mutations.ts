import {
  useMutation,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";

import { customersApi } from "../api/customers-api";
import { applyMove } from "../lib/pipeline";
import type {
  BulkAction,
  ContactLogInput,
  CustomerInput,
  CustomerUpdate,
  MoveCustomerInput,
  NoteInput,
} from "../lib/schemas";
import type { Customer, CustomerListParams, Paginated } from "../types";
import { customerKeys } from "./query-keys";

// Each hook owns its cache updates so components only deal with user feedback
// (toasts, closing dialogs) through `mutate`'s callbacks or `mutateAsync`.
//
// `onSuccess` returns the invalidation promise on purpose: the mutation stays
// pending until the affected queries have refetched, so a dialog that closes
// when the mutation settles never reveals stale rows.

/** Refetches every list view and the company options, which depend on all customers. */
function invalidateCollections(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: customerKeys.lists() }),
    queryClient.invalidateQueries({ queryKey: customerKeys.companies() }),
  ]);
}

/** Drops cached detail and notes for customers that no longer exist. */
function removeDetails(queryClient: QueryClient, ids: readonly string[]) {
  for (const id of ids) {
    // The detail key is a prefix of the notes key, so this removes both.
    queryClient.removeQueries({ queryKey: customerKeys.detail(id) });
  }
}

/** Writes a server-returned customer straight into the detail cache. */
function setDetail(queryClient: QueryClient, customer: Customer) {
  queryClient.setQueryData(customerKeys.detail(customer.id), customer);
}

export function useCreateCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CustomerInput) => customersApi.create(input),
    onSuccess: (customer) => {
      setDetail(queryClient, customer);
      return invalidateCollections(queryClient);
    },
  });
}

export function useUpdateCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: CustomerUpdate }) =>
      customersApi.update(id, input),
    onSuccess: (customer) => {
      setDetail(queryClient, customer);
      return invalidateCollections(queryClient);
    },
  });
}

export function useDeleteCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => customersApi.remove(id),
    onSuccess: (_data, id) => {
      removeDetails(queryClient, [id]);
      return invalidateCollections(queryClient);
    },
  });
}

export function useBulkCustomerAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (action: BulkAction) => customersApi.bulk(action),
    onSuccess: (_result, action) => {
      if (action.action === "delete") {
        removeDetails(queryClient, action.ids);
        return invalidateCollections(queryClient);
      }
      // A status change touches lists and any cached details of those customers.
      return queryClient.invalidateQueries({ queryKey: customerKeys.all });
    },
  });
}

/** Records a contact, updating the customer's last-contact date and method. */
export function useLogContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ContactLogInput }) =>
      customersApi.logContact(id, input),
    onSuccess: (customer, { input }) => {
      setDetail(queryClient, customer);
      return Promise.all([
        queryClient.invalidateQueries({ queryKey: customerKeys.lists() }),
        // The optional summary is stored as a note.
        input.note
          ? queryClient.invalidateQueries({
              queryKey: customerKeys.notes(customer.id),
            })
          : undefined,
      ]);
    },
  });
}

const MOVE_MUTATION_KEY = ["customers", "move"] as const;

type MoveVariables = {
  id: string;
  input: MoveCustomerInput;
  /** The board's list as it was before the optimistic update, for rollback. */
  previous: Paginated<Customer> | undefined;
};

/**
 * Moves a customer to a status column and position on the pipeline board,
 * optimistically.
 *
 * `move` rewrites the board's cached list before the request is sent, so the
 * card lands immediately. The write is synchronous (rather than in `onMutate`,
 * which runs a tick later) so there is no frame where the card jumps back to
 * its old place after being dropped. On failure the list is restored, and once
 * the last in-flight move settles the lists are refetched from the server.
 */
export function useMoveCustomer(boardParams: CustomerListParams) {
  const queryClient = useQueryClient();
  const boardKey = customerKeys.list(boardParams);

  const mutation = useMutation({
    mutationKey: MOVE_MUTATION_KEY,
    mutationFn: ({ id, input }: MoveVariables) => customersApi.move(id, input),
    onSuccess: (customer) => setDetail(queryClient, customer),
    onError: (_error, { previous }) => {
      queryClient.setQueryData(boardKey, previous);
    },
    onSettled: () => {
      // With several quick moves, refetching after each would briefly show a
      // server state that lacks the later ones.
      if (queryClient.isMutating({ mutationKey: MOVE_MUTATION_KEY }) > 1) return;
      return queryClient.invalidateQueries({ queryKey: customerKeys.lists() });
    },
  });

  const move = (
    id: string,
    input: MoveCustomerInput,
    callbacks?: { onError?: (error: Error) => void },
  ) => {
    // Stop any in-flight refetch from overwriting the optimistic list.
    void queryClient.cancelQueries({ queryKey: customerKeys.lists() });
    const previous = queryClient.getQueryData<Paginated<Customer>>(boardKey);
    if (previous) {
      queryClient.setQueryData<Paginated<Customer>>(boardKey, {
        ...previous,
        items: applyMove(previous.items, id, input),
      });
    }
    mutation.mutate({ id, input, previous }, callbacks);
  };

  return { move, isPending: mutation.isPending };
}

export function useAddNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      customerId,
      input,
    }: {
      customerId: string;
      input: NoteInput;
    }) => customersApi.addNote(customerId, input),
    onSuccess: (_note, { customerId }) =>
      queryClient.invalidateQueries({ queryKey: customerKeys.notes(customerId) }),
  });
}

export function useDeleteNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      customerId,
      noteId,
    }: {
      customerId: string;
      noteId: string;
    }) => customersApi.removeNote(customerId, noteId),
    onSuccess: (_data, { customerId }) =>
      queryClient.invalidateQueries({ queryKey: customerKeys.notes(customerId) }),
  });
}
