<script setup lang="ts">
import { useGoogleMaps } from "@/composables/useGoogleMaps";
import { useDebounceFn } from "@vueuse/core";

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
const isOpen = ref(false);
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
  if (!input.value || input.value.length < 3) {
    searchOptions.value = [];
    isOpen.value = false;
    return;
  }

  isSearching.value = true;

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

    const newOptions = [];

    for (const suggestion of suggestions.slice(0, 5)) {
      const placePrediction = suggestion.placePrediction;

      if (placePrediction) {
        newOptions.push({
          text: placePrediction.text.toString(),
          placePrediction: placePrediction,
        });
      }
    }

    searchOptions.value = newOptions;
    isOpen.value = searchOptions.value.length > 0;
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
    if (nextComponent && component.longText === nextComponent.longText) {
      fullAddress += component.shortText + ", ";
    } else {
      fullAddress += component.longText + ", ";
    }

    component.types.forEach((type) => {
      if (components.hasOwnProperty(type)) {
        components[type as keyof typeof components] = component.longText;
      }
    });
  });

  fullAddress = fullAddress.trim().replace(/,$/, "");

  input.value = fullAddress;
  emit("update:streetNumber", components.street_number);
  emit("update:street", components.route);
  emit("update:city", components.locality);
  emit("update:zipCode", components.postal_code);
  emit("update:country", components.country);
};

watch(input, () => {
  if (!isClickedOption.value) {
    if (input.value && input.value.length >= 3) {
       // Debounce the search
       useDebounceFn(async () => await search(), 500)();
    } else {
        isOpen.value = false;
    }
  }
});

const onSelect = async (
  placePrediction: google.maps.places.PlacePrediction
) => {
  isClickedOption.value = true;
  isOpen.value = false;
  searchOptions.value = [];

  const place = await placePredictionToPlace(placePrediction);
  formatPlace(place);

  setTimeout(() => {
    isClickedOption.value = false;
  }, 300);
};
</script>

<template>
  <div class="form-control w-full relative dropdown" :class="{ 'dropdown-open': isOpen && searchOptions.length > 0 && !isClickedOption }">
    <label v-if="props.label" class="label">
      <span class="label-text font-semibold">{{ props.label }}</span>
    </label>

    <div class="relative">
      <input
        ref="inputRef"
        v-model="input"
        type="text"
        :placeholder="props.placeholder ?? 'Buscar dirección...'"
        class="input input-bordered w-full"
        :class="{
          'input-error': props.errors?.address,
        }"
        autocomplete="off"
        @focus="isOpen = true"
        @blur="setTimeout(() => isOpen = false, 200)"
      />
      <div v-if="isSearching" class="absolute right-3 top-1/2 -translate-y-1/2">
        <span class="loading loading-spinner loading-xs opacity-50"></span>
      </div>
    </div>

    <div
      v-if="isOpen && searchOptions.length > 0 && !isClickedOption"
      class="dropdown-content z-50 menu p-2 shadow bg-base-100 rounded-box w-full border border-base-content/20 mt-1 block"
    >
      <ul class="w-full p-0">
        <li v-for="(option, index) in searchOptions" :key="index">
          <a @click.prevent="onSelect(option.placePrediction)" class="py-2">
            {{ option.text }}
          </a>
        </li>
      </ul>
    </div>

    <label v-if="props.errors?.address" class="label">
      <span class="label-text-alt text-error">{{ props.errors.address }}</span>
    </label>
  </div>
</template>
