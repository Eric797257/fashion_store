import { ShoppingBag, Truck, ShieldCheck } from "lucide-react";
import { brand } from "@/config/brand";
import { formatMoney } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ThemePreviewPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <Badge variant="secondary" className="mb-6">
        Theme preview – replaced in Step 3
      </Badge>

      <h1 className="text-5xl font-semibold sm:text-6xl">{brand.name}</h1>
      <p className="mt-4 max-w-xl text-lg text-muted-foreground">{brand.tagline}</p>

      <div className="mt-8 flex flex-wrap gap-3">
        <Button size="lg" className="bg-primary hover:bg-primary-hover">
          <ShoppingBag className="mr-2 size-4" /> Shop now
        </Button>
        <Button size="lg" variant="outline">
          View lookbook
        </Button>
      </div>

      <div className="mt-14 grid gap-6 sm:grid-cols-3">
        <Card className="shadow-soft">
          <CardContent className="space-y-2 p-6">
            <div className="aspect-[4/5] rounded-md bg-secondary" />
            <p className="font-medium">Sample linen shirt</p>
            <div className="flex items-baseline gap-2">
              <span className="font-semibold text-primary">{formatMoney(38000)}</span>
              <span className="text-sm text-muted-foreground line-through">
                {formatMoney(45000)}
              </span>
            </div>
            <Badge className="bg-success text-white">In stock</Badge>
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardContent className="space-y-2 p-6">
            <Truck className="size-6 text-primary" />
            <h2 className="text-2xl font-semibold">Fast delivery</h2>
            <p className="text-sm text-muted-foreground">
              Our own delivery team and trusted couriers.
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardContent className="space-y-3 p-6">
            <ShieldCheck className="size-6 text-primary" />
            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" placeholder="+95 9 …" />
            </div>
          </CardContent>
        </Card>
      </div>

      <p lang="my" className="mt-12 text-muted-foreground">
        မြန်မာဘာသာ စာလုံးပြသမှု စမ်းသပ်ချက် – Burmese font test
      </p>
    </main>
  );
}