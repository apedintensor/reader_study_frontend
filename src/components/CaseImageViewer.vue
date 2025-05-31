<template>
  <Card class="mb-4">
    <template #title>Case Images</template>
    <template #content>
      <div v-if="loading" class="text-center">
        <ProgressBar mode="indeterminate" style="height: .5em" />
        <p>Loading images...</p>
      </div>
      <div v-else-if="images && images.length > 0">
        <Carousel :value="images" :numVisible="1" :numScroll="1" circular :autoplayInterval="5000">
          <template #item="slotProps">
            <div class="image-container p-2">
              <Image :src="slotProps.data.image_url" alt="Case Image" width="100%" preview />
            </div>
          </template>
        </Carousel>
      </div>
      <div v-else class="text-center">
        <p>No images available for this case.</p>
      </div>
    </template>
  </Card>
</template>

<script setup lang="ts">
import Card from 'primevue/card';
import Carousel from 'primevue/carousel';
import Image from 'primevue/image';
import ProgressBar from 'primevue/progressbar';

interface ImageRead {
  id: number;
  image_url: string;
  case_id: number;
}

defineProps<{
  images: ImageRead[];
  loading: boolean;
}>();
</script>

<style scoped>
.image-container img {
  width: 100%;
  max-height: 500px; /* Adjust as needed */
  object-fit: contain;
  border-radius: var(--border-radius);
}
.text-center {
  text-align: center;
  padding: 1rem;
}
</style>
