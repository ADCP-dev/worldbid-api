<script setup lang="ts">
import { useGoogleMaps } from "@/composables/useGoogleMaps";
import { useDebounceFn } from "@vueuse/core";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

const props = defineProps<{
  errors?: Record<string, string>;
  isEstablishment?: boolean;
  label?: string;
  placeholder?: string;
}>();

const input = defineModel<string>();
const searchOptions = ref<
  { text: string; placePrediction: google.maps.places.PlacePrediction }[]
>([]);
const isClickedOption = ref(false);
const isOpen = ref(true);
const inputRef = ref<HTMLInputElement>();
const isSearching = ref(false);

const emit = defineEmits<{
  (
    e:
      | "update:streetNumber"
      | "update:street"
      | "update:city"
      | "update:zipCode"
      | "update:country",
    value: string
  ): void;
}>();

onMounted(async () => {
  await useGoogleMaps().loadGoogleMapsApi();
});

const search = async () => {
  // If input is too short, clear options and close dropdown
  if (!input.value || input.value.length < 3) {
    searchOptions.value = [];
    isOpen.value = false;
    return;
  }
  
  // Set searching flag to prevent duplicate searches
  isSearching.value = true;
  
  // Keep the current options visible until we have new ones
  // This prevents flickering

  try {
    const { AutocompleteSessionToken, AutocompleteSuggestion } =
      (await google.maps.importLibrary("places")) as google.maps.PlacesLibrary;
  
    const request: google.maps.places.AutocompleteRequest = {
      input: input.value,
      sessionToken: new AutocompleteSessionToken(),
      language: "es",
      region: "es",
      includedPrimaryTypes: props.isEstablishment
        ? ["establishment"]
        : ["route", "locality", "postal_code"],
    };
  
    const { suggestions } =
      await AutocompleteSuggestion.fetchAutocompleteSuggestions(request);
  
    // Create new array for results but don't clear existing options until we have results
    const newOptions = [];
    
    // Only show 5 suggestions
    for (const suggestion of suggestions.slice(0, 5)) {
      const placePrediction = suggestion.placePrediction;
  
      if (placePrediction) {
        newOptions.push({
          text: placePrediction.text.toString(),
          placePrediction: placePrediction,
        });
      }
    }
    
    // Replace options with new results all at once to prevent flickering
    searchOptions.value = newOptions;
  
    // Update dropdown visibility based on results
    if (searchOptions.value.length > 0) {
      isOpen.value = true;
    } else {
      isOpen.value = false;
    }
  } catch (error) {
    console.error("Error searching for places:", error);
  } finally {
    isSearching.value = false;
  }
};

const placePredictionToPlace = async (
  placePrediction: google.maps.places.PlacePrediction
) => {
  const place = placePrediction.toPlace();
  if (place) {
    await place.fetchFields({
      fields: ["addressComponents"],
    });
  }
  return place;
};

const formatPlace = (place: google.maps.places.Place) => {
  const components = {
    street_number: "",
    route: "",
    locality: "",
    postal_code: "",
    country: "",
  };

  let fullAddress = "";

  place.addressComponents?.forEach((component, index) => {
    const nextComponent = place.addressComponents?.[index + 1];

    // Use short_name if long_name is equal to the next component
    if (nextComponent && component.longText === nextComponent.longText) {
      fullAddress += component.shortText + ", ";
    } else {
      fullAddress += component.longText + ", ";
    }

    // By component
    component.types.forEach((type) => {
      if (components.hasOwnProperty(type)) {
        components[type] = component.longText;
      }
    });
  });

  // Delete last comma
  fullAddress = fullAddress.trim().replace(/,$/, "");

  // Update state and emit events

  input.value = fullAddress;
  emit("update:streetNumber", components.street_number);
  emit("update:street", components.route);
  emit("update:city", components.locality);
  emit("update:zipCode", components.postal_code);
  emit("update:country", components.country);
};

watch(input, () => {
  if (!isClickedOption.value) {
    // Keep dropdown open if we have results and are searching more
    if (input.value && input.value.length >= 3 && searchOptions.value.length > 0) {
      isOpen.value = true;
    }
    
    // Debounce the search to prevent too many API calls
    useDebounceFn(async () => await search(), 500)();
  }
});

const onSelect = async (
  placePrediction: google.maps.places.PlacePrediction
) => {
  isClickedOption.value = true;
  
  // Close dropdown immediately
  isOpen.value = false;
  searchOptions.value = [];
  
  // Process the selection
  const place = await placePredictionToPlace(placePrediction);
  formatPlace(place);
  
  // Return focus to input field manually
  setTimeout(() => {
    // Get the input element directly from the DOM to ensure we can focus it
    const inputElement = document.querySelector('input.google-places-input');
    if (inputElement instanceof HTMLInputElement) {
      inputElement.focus();
    }
    // Make sure dropdown stays closed
    isClickedOption.value = false;
  }, 50);
};
</script>

<template>
  <div class="relative w-full">
    <Label v-if="props.label">{{ props.label }}</Label>
    <div class="relative">
      <Input
        ref="inputRef"
        v-model="input"
        :placeholder="props.placeholder ?? 'Buscar dirección...'"
        :class="[
          'google-places-input',
          {
            'border-destructive': props.errors?.address,
            'ring-destructive': props.errors?.address,
          }
        ]"
        autocomplete="off"
        @focus="isOpen = true"
      />
    </div>
    <div
      v-show="isOpen && searchOptions.length > 0 && !isClickedOption"
      class="absolute z-50 min-w-[8rem] w-full overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2"
    >
      <Command class="w-full">
        <CommandList>
          <CommandEmpty v-if="searchOptions.length === 0">
            No se encontraron resultados.
          </CommandEmpty>
          <CommandGroup v-else>
            <CommandItem
              v-for="(option, index) in searchOptions"
              :key="index"
              :value="option.text"
              @select="() => onSelect(option.placePrediction)"
              class="cursor-pointer"
            >
              {{ option.text }}
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </div>

    <p v-if="props.errors?.address" class="text-sm text-destructive mt-1">
      {{ props.errors.address }}
    </p>
  </div>
</template>
