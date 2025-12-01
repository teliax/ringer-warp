import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { InfoIcon } from "lucide-react";
import type { Brand10DLC, UpdateBrandRequest } from "@/types/messaging";

const updateBrandSchema = z.object({
  business_contact_first_name: z.string().min(2, "First name required"),
  business_contact_last_name: z.string().min(2, "Last name required"),
  business_contact_email: z.string().email("Valid email required"),
  website: z.string().url("Valid URL required").optional().or(z.literal("")),
});

type UpdateBrandFormData = z.infer<typeof updateBrandSchema>;

interface EditBrandDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  brand: Brand10DLC;
  onSubmit: (data: UpdateBrandRequest) => Promise<void>;
}

export function EditBrandDialog({
  open,
  onOpenChange,
  brand,
  onSubmit,
}: EditBrandDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<UpdateBrandFormData>({
    resolver: zodResolver(updateBrandSchema),
    defaultValues: {
      business_contact_first_name: brand.business_contact_first_name || "",
      business_contact_last_name: brand.business_contact_last_name || "",
      business_contact_email: brand.business_contact_email || "",
      website: brand.website || "",
    },
  });

  const handleSubmit = async (data: UpdateBrandFormData) => {
    setIsSubmitting(true);
    try {
      await onSubmit(data);
      onOpenChange(false);
    } catch (error) {
      // Error handled by parent
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit Brand Information</DialogTitle>
          <DialogDescription>
            Update business contact information for {brand.display_name}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <Alert>
              <InfoIcon className="h-4 w-4" />
              <AlertDescription>
                Business contact email is required for TCR identity verification. For PUBLIC_PROFIT brands, it's also required for Auth+ 2FA verification.
              </AlertDescription>
            </Alert>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="business_contact_first_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>First Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="John" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="business_contact_last_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="Doe" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="business_contact_email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Business Contact Email *</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="contact@company.com" {...field} />
                  </FormControl>
                  <FormDescription>
                    Must be a company domain email (not personal email like Gmail)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="website"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Website</FormLabel>
                  <FormControl>
                    <Input placeholder="https://company.com" {...field} />
                  </FormControl>
                  <FormDescription>Company website (recommended)</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Updating..." : "Update Brand"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
